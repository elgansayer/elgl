import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Cron } from '@nestjs/schedule';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import {
  DiscoveryDegradationService,
  DegradationMarker,
} from './discovery-degradation.service';
import { sanitiseDiscoveryData } from './sanitise-discovery.helper';
import { resolveVipMockLocation } from './vip-location-spoof.policy';
import { CorrectorScoreService } from '../corrector-score/corrector-score.service';
import {
  getSeriousLearnerActiveSince,
  isActiveSeriousLearner,
  SERIOUS_LEARNER_MIN_STREAK_DAYS,
} from './serious-learner.policy';

type DiscoveryUser = UserProfile & {
  distance?: number;
  distance_metres?: number;
  is_partner_of_week?: boolean;
  proficiency_level?: string;
  age?: number;
  gender?: string;
  country?: string;
  city?: string;
  interests?: string[];
  learning_goals?: string[];
  availability_morning?: boolean;
  availability_afternoon?: boolean;
  availability_evening?: boolean;
  available_time_start?: string;
  available_time_end?: string;
  last_active_at?: string;
  coins_balance?: number;
  match_reasons?: string[];
  _matchScore?: number;
};

function parseStoredPoint(location: string | undefined): {
  latitude: number;
  longitude: number;
} | null {
  if (!location) return null;
  const match = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i.exec(
    location,
  );
  if (!match) return null;

  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export interface DiscoveryResult<T = UserProfile[]> {
  data: T;
  marker: DegradationMarker;
}

@Injectable()
export class DiscoveryService {
  constructor(
    @InjectPinoLogger(DiscoveryService.name)
    private readonly logger: PinoLogger,
    private readonly audioRoomsService: AudioRoomsService,
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly degradationService: DiscoveryDegradationService,
    @Optional() private readonly correctorScoreService?: CorrectorScoreService,
  ) {}

  // Weekly computation of Partner of the Week (every Sunday at midnight)
  // Multi-signal ranking algorithm:
  //   1. Fetch a candidate pool: discoverable, complete users with correction_ratio > 0.5,
  //      and an active 7-day study streak, ordered by descending correction_ratio (top 50).
  //   2. For each candidate, fetch their corrector rating score via CorrectorScoreService.
  //   3. Compute a weighted composite score:
  //        - Correction ratio .................. 30 %
  //        - Corrector rating average (normalised 1-5 -> 0-1) ... 35 %
  //        - Total corrector ratings count (log-scaled) .......... 15 %
  //        - Study streak days (log-scaled) ...................... 20 %
  //   4. Rank by composite score descending, select top 10.
  //   5. Store the list as JSON in Redis with a 7-day TTL.
  @Cron('0 0 * * 0')
  async calculatePartnerOfWeek(): Promise<void> {
    this.logger.info('Starting Partner of the Week calculation...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    const clearStalePartnerCache = async (): Promise<void> => {
      try {
        await redis.del('partner_of_week_ids');
      } catch (err) {
        this.logger.error(
          'Failed to clear stale Partner of the Week cache',
          err,
        );
      }
    };

    try {
      const seriousLearnerNow = new Date();
      const seriousLearnerActiveSince =
        getSeriousLearnerActiveSince(seriousLearnerNow);

      // Step 1: Keep the weekly highlight inside the same core visibility boundary
      // as ordinary discovery: hidden or deletion-pending accounts must never be
      // surfaced, and incomplete profiles are not useful recommendations.
      const { data: candidates, error } = await supabase
        .from('users')
        .select(
          'id, display_name, native_languages, target_languages, privacy_hide_from_search, is_deletion_pending, scheduled_for_deletion_at, correction_ratio, study_streak_days, last_active_at',
        )
        .eq('privacy_hide_from_search', false)
        .eq('is_deletion_pending', false)
        .is('scheduled_for_deletion_at', null)
        .not('display_name', 'is', null)
        .not('native_languages', 'is', null)
        .not('target_languages', 'is', null)
        .gt('correction_ratio', 0.5)
        .gte('study_streak_days', SERIOUS_LEARNER_MIN_STREAK_DAYS)
        .gte('last_active_at', seriousLearnerActiveSince)
        .order('correction_ratio', { ascending: false })
        .limit(50);

      if (error) {
        this.logger.error(
          'Failed to fetch Partner of the Week candidates',
          error,
        );
        await clearStalePartnerCache();
        return;
      }

      const qualifiedCandidates = candidates?.filter(
        (candidate) =>
          candidate.privacy_hide_from_search === false &&
          candidate.is_deletion_pending === false &&
          candidate.scheduled_for_deletion_at === null &&
          typeof candidate.display_name === 'string' &&
          candidate.display_name.trim().length > 0 &&
          Array.isArray(candidate.native_languages) &&
          candidate.native_languages.length > 0 &&
          Array.isArray(candidate.target_languages) &&
          candidate.target_languages.length > 0 &&
          (candidate.correction_ratio ?? 0) > 0.5 &&
          isActiveSeriousLearner(candidate, seriousLearnerNow),
      );

      if (!qualifiedCandidates || qualifiedCandidates.length === 0) {
        this.logger.warn('No users qualified for Partner of the Week');
        await clearStalePartnerCache();
        return;
      }

      // Step 2: Fetch corrector scores for all candidates in parallel
      const scoreMap = new Map<
        string,
        { averageScore: number; totalRatings: number }
      >();

      if (this.correctorScoreService) {
        const scorePromises = qualifiedCandidates.map(async (c) => {
          try {
            const score = await this.correctorScoreService!.getCorrectorScore(
              c.id,
            );
            return { id: c.id, score };
          } catch {
            const fallback: {
              averageScore: number | null;
              totalRatings: number;
            } = {
              averageScore: null,
              totalRatings: 0,
            };
            return { id: c.id, score: fallback };
          }
        });
        const scores = await Promise.all(scorePromises);
        for (const { id, score } of scores) {
          scoreMap.set(id, {
            averageScore: score.averageScore ?? 0,
            totalRatings: score.totalRatings,
          });
        }
      }

      // Step 3: Compute composite ranking score
      // Normalisation helpers
      const maxStreak = Math.max(
        ...qualifiedCandidates.map((c) => c.study_streak_days ?? 0),
        1,
      );
      const maxRatings = Math.max(
        ...[...scoreMap.values()].map((v) => v.totalRatings),
        1,
      );

      const computeComposite = (candidate: {
        id: string;
        correction_ratio: number | null;
        study_streak_days: number | null;
      }): number => {
        const ratings = scoreMap.get(candidate.id) ?? {
          averageScore: 0,
          totalRatings: 0,
        };

        const correctionRatio = candidate.correction_ratio ?? 0;
        // Normalise average rating to 0-1 (1-5 scale)
        const avgRatingNorm =
          Number.isFinite(ratings.averageScore) && ratings.averageScore > 0
            ? Math.min(1, Math.max(0, (ratings.averageScore - 1) / 4))
            : 0;
        // Log-scale the ratings count so it doesn't dominate
        const ratingsCountLog =
          ratings.totalRatings > 0
            ? Math.log10(ratings.totalRatings + 1) / Math.log10(maxRatings + 1)
            : 0;
        // Log-scale the streak
        const streakDays = candidate.study_streak_days ?? 0;
        const streakLog =
          streakDays > 0
            ? Math.log10(streakDays + 1) / Math.log10(maxStreak + 1)
            : 0;

        return (
          correctionRatio * 0.3 +
          avgRatingNorm * 0.35 +
          ratingsCountLog * 0.15 +
          streakLog * 0.2
        );
      };

      // Step 4: Rank and select top 10. User ID is a stable, privacy-neutral
      // tie-breaker so the same inputs always produce the same ordering.
      const ranked = qualifiedCandidates
        .map((c) => ({
          id: c.id,
          composite: computeComposite(c),
        }))
        .sort((a, b) => b.composite - a.composite || a.id.localeCompare(b.id));

      const top10 = ranked.slice(0, 10);
      const partnerIds = top10.map((r) => r.id);

      // Step 5: Store in Redis
      await redis.set(
        'partner_of_week_ids',
        JSON.stringify(partnerIds),
        'EX',
        604800,
      );
      this.logger.info(
        `Partner of the Week cache refreshed for ${partnerIds.length} users`,
      );
    } catch (err) {
      this.logger.error('Error calculating Partner of the Week', err);
      await clearStalePartnerCache();
    }
  }

  // Expose only Partner of the Week IDs that remain discoverable now. The
  // weekly Redis ranking is intentionally revalidated on every read so a
  // privacy, account-deletion, or viewer block change cannot remain visible
  // for its 7-day TTL.
  async getPartnerOfWeekIds(viewerId: string): Promise<string[]> {
    const redis = this.supabaseService.getRedisClient();
    const raw = await redis.get('partner_of_week_ids');
    const cachedIds = this.parseStringArray(raw);
    if (cachedIds.length === 0) return [];

    try {
      const blockedIds = new Set(
        await this.safetyService.getBlockedAndBlockerIds(viewerId),
      );
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('id')
        .in('id', cachedIds)
        .eq('privacy_hide_from_search', false)
        .eq('is_deletion_pending', false)
        .is('scheduled_for_deletion_at', null)
        .limit(cachedIds.length);

      if (error || !data) {
        this.logger.error(
          'Failed to revalidate Partner of the Week privacy state',
        );
        return [];
      }

      const discoverableIds = new Set(
        (data as Array<{ id?: unknown }>)
          .map((row) => row.id)
          .filter((id): id is string => typeof id === 'string'),
      );
      return sanitiseDiscoveryData(
        cachedIds.filter(
          (id) => discoverableIds.has(id) && !blockedIds.has(id),
        ),
      );
    } catch {
      this.logger.error(
        'Failed to revalidate Partner of the Week privacy state',
      );
      return [];
    }
  }

  async searchPartners(
    currentUserId: string,
    _currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
    verifiedBlockedIds?: string[],
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

    const blockedIds =
      verifiedBlockedIds ??
      (await this.safetyService.getBlockedAndBlockerIds(currentUserId));

    const seriousLearnerOnly =
      query.serious_learner_only === true ||
      query.serious_learner_mode === true ||
      _currentUserProfile?.serious_learner_mode === true;
    if (seriousLearnerOnly) {
      query.serious_learner_only = true;
    }
    const seriousLearnerActiveSince = seriousLearnerOnly
      ? getSeriousLearnerActiveSince()
      : null;

    let searchLat = query.latitude;
    let searchLon = query.longitude;
    const hasBrowserCoordinates =
      query.latitude !== undefined || query.longitude !== undefined;

    // The standard discovery controls express a radius relative to the
    // authenticated learner's saved location for VIP members. Browser
    // coordinates remain available to the explicit Nearby flow.
    if (
      query.radius_metres !== undefined &&
      !hasBrowserCoordinates &&
      !_currentUserProfile?.is_vip
    ) {
      throw new ForbiddenException('Distance filtering requires VIP');
    }
    if (query.radius_metres !== undefined && !hasBrowserCoordinates) {
      const storedPoint = parseStoredPoint(_currentUserProfile?.location);
      searchLat = storedPoint?.latitude;
      searchLon = storedPoint?.longitude;
    }

    // Apply VIP location spoofing: a VIP's stored mock_location replaces the
    // request coordinates. VIP status and the stored point come from the
    // server-loaded profile, never from the query, so a client cannot opt in.
    const profile = _currentUserProfile;
    const mockLocation = resolveVipMockLocation(profile);
    if (mockLocation.status === 'applied') {
      searchLat = mockLocation.point.latitude;
      searchLon = mockLocation.point.longitude;
    } else if (mockLocation.status === 'invalid') {
      // Log the value type only: the stored coordinates are personal data.
      this.logger.warn(
        { mockLocationType: typeof profile?.mock_location },
        'Ignoring unusable VIP mock_location; using request coordinates',
      );
    }
    if (profile?.is_vip) {
      // Apply VIP country/city spoofing
      if (profile.mock_country) {
        query.country = profile.mock_country;
      }
      if (profile.mock_city) {
        query.city = profile.mock_city;
      }
    }

    if (
      query.radius_metres !== undefined &&
      (searchLat === undefined || searchLon === undefined)
    ) {
      throw new BadRequestException(
        'A saved location or browser coordinates are required for distance filtering',
      );
    }

    // Serious Learner mode must be resolved before the standard Supabase query
    // is constructed so every discovery path applies the same thresholds.
    if (
      _currentUserProfile?.serious_learner_mode === true ||
      query.serious_learner_mode
    ) {
      query.serious_learner_only = true;
    }

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, interests, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null);

    if (query.has_audio_intro) {
      queryBuilder = queryBuilder
        .not('audio_intro_url', 'is', null)
        .neq('audio_intro_url', '');
    }

    if (blockedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', blockedIds);
    }

    if (query.native_languages) {
      queryBuilder = queryBuilder.contains('native_languages', [
        query.native_languages,
      ]);
    }

    if (query.target_language) {
      queryBuilder = queryBuilder.contains('target_languages', [
        query.target_language,
      ]);
    }

    if (seriousLearnerOnly && seriousLearnerActiveSince) {
      queryBuilder = queryBuilder
        .gte('study_streak_days', SERIOUS_LEARNER_MIN_STREAK_DAYS)
        .gte('last_active_at', seriousLearnerActiveSince);
    }

    if (query.level) {
      queryBuilder = queryBuilder.eq('proficiency_level', query.level);
    }

    if (_currentUserProfile?.is_vip && query.gender) {
      queryBuilder = queryBuilder.eq('gender', query.gender);
    }

    if (query.interests) {
      queryBuilder = queryBuilder.overlaps('interests', [query.interests]);
    }

    if (query.age_min !== undefined) {
      queryBuilder = queryBuilder.gte('age', query.age_min);
    }
    if (query.age_max !== undefined) {
      queryBuilder = queryBuilder.lte('age', query.age_max);
    }

    if (query.country) {
      queryBuilder = queryBuilder.ilike('country', `%${query.country}%`);
    }
    if (query.city) {
      queryBuilder = queryBuilder.ilike('city', `%${query.city}%`);
    }

    // Function that enriches and sorts results with Partner of the Week flag
    const enrich = async (users: UserProfile[]): Promise<UserProfile[]> => {
      let filtered = users;
      // Apply advanced filters (learning_goals, availability)
      if (
        query.learning_goals !== undefined ||
        query.availability_morning !== undefined ||
        query.availability_afternoon !== undefined ||
        query.availability_evening !== undefined
      ) {
        try {
          filtered = this.applyAdvancedFilters(filtered, query);
        } catch (err) {
          this.logger.error(
            'Advanced filters failed, returning unfiltered results',
            err,
          );
        }
      }
      let partnerSet = new Set<string>();
      try {
        const raw = await this.supabaseService
          .getRedisClient()
          .get('partner_of_week_ids');
        const partnerIds = this.parseStringArray(raw);
        partnerSet = new Set(partnerIds);
      } catch (err) {
        this.logger.error(
          'Failed to load partner-of-week IDs, continuing without PoW badges',
          err,
        );
      }
      const enriched = filtered.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
      return sanitiseDiscoveryData(
        this.sortUsers(
          enriched,
          query.sort,
          searchLat,
          searchLon,
          _currentUserProfile,
        ),
      );
    };

    if (searchLat !== undefined && searchLon !== undefined) {
      const response = (await supabase.rpc('search_nearby_users', {
        search_lat: searchLat,
        search_lon: searchLon,
        radius_m: query.radius_metres ?? 50000,
        exclude_user_id: currentUserId,
        filter_native_arr: query.native_languages
          ? [query.native_languages]
          : null,
        filter_target: query.target_language || null,
        serious_only: seriousLearnerOnly,
        filter_level: query.level || null,
        filter_gender:
          _currentUserProfile?.is_vip && query.gender ? query.gender : null,
        filter_age_min: query.age_min ?? null,
        filter_age_max: query.age_max ?? null,
        filter_audio_intro: query.has_audio_intro === true,
      })) as unknown as {
        data: unknown[] | null;
        error: { message?: string } | null;
      };

      if (response.error || !response.data) {
        this.logger.warn(
          {
            error: response.error?.message ?? 'PostGIS returned no data',
          },
          'PostGIS partner search failed; radius filter unavailable',
        );
        // A non-spatial fallback cannot honour the requested radius. Returning
        // those rows would silently turn the distance control into a no-op.
        throw new ServiceUnavailableException(
          'Partner discovery is temporarily unavailable',
        );
      }

      // An empty result is a successful spatial search. Falling back here
      // would leak users outside the requested radius into proximity results.
      if (response.data.length === 0) {
        return enrich([]);
      }

      let rpcResults: DiscoveryUser[] = (
        response.data as unknown as DiscoveryUser[]
      ).map((item) => ({
        ...item,
        distance_metres: item.distance_metres ?? item.distance ?? undefined,
      }));
      if (blockedIds.length > 0) {
        const blockedSet = new Set(blockedIds);
        rpcResults = rpcResults.filter((u) => !blockedSet.has(u.id));
      }
      // RPC now handles level, gender, age, and audio_intro filters natively,
      // but interests still needs post-processing since the RPC returns interests column
      if (query.interests) {
        rpcResults = rpcResults.filter((u) =>
          u.interests?.includes(query.interests!),
        );
      }
      const filtered = await this.filterByVoiceRoomActive(
        rpcResults,
        query.voice_room_active === true,
      );
      this.logger.info(
        {
          count: filtered.length,
          radius_m: query.radius_metres ?? 50000,
        },
        'PostGIS proximity search matched nearby partners within radius',
      );
      return enrich(filtered);
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data) {
      throw new ServiceUnavailableException(
        'Partner discovery is temporarily unavailable',
      );
    }
    if (response.data.length === 0) {
      return enrich([]);
    }
    let results: DiscoveryUser[] = (
      response.data as unknown as DiscoveryUser[]
    ).map((item) => ({
      ...item,
      distance_metres: item.distance_metres ?? item.distance ?? undefined,
    }));
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }
    // When a proficiency level is requested, keep users that either have the
    // matching level or do not yet have a level recorded (fresh profiles).
    if (query.level) {
      const requestedLevel = query.level;
      results = results.filter(
        (u) =>
          u.proficiency_level === undefined ||
          u.proficiency_level === requestedLevel,
      );
    }
    const filtered = await this.filterByVoiceRoomActive(
      results,
      query.voice_room_active === true,
    );
    return enrich(filtered);
  }
  /**
   * Degradation-aware variant of searchPartners.
   * Returns a DiscoveryResult with a degradation marker indicating if
   * fallback data was served and why.
   */
  async searchPartnersWithDegradation(
    currentUserId: string,
    currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<DiscoveryResult> {
    // The complete block graph is a security boundary, not an availability
    // dependency. Resolve it before entering the circuit breaker so a failed or
    // malformed lookup can never fall through to unfiltered fallback profiles.
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);
    const marker: DegradationMarker = {
      degraded: false,
      fallbackSource: 'none',
    };

    try {
      const result = await this.degradationService.executeWithBreaker(
        'discovery_partners',
        () =>
          this.searchPartners(
            currentUserId,
            currentUserProfile,
            query,
            blockedIds,
          ),
        () => {
          marker.fallbackSource = 'basic_query';
          return [] as UserProfile[];
        },
        marker,
      );

      if (marker.degraded && result.length === 0) {
        await this.degradationService.recordDegradationEvent(
          '/discovery/partners',
          marker.reason ?? 'Partner search unavailable',
          marker.fallbackSource ?? 'basic_query',
          currentUserId,
        );
      }

      return { data: result, marker };
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        error.getStatus() >= 400 &&
        error.getStatus() < 500
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      await this.degradationService.recordDegradationEvent(
        '/discovery/partners',
        message,
        'basic_query',
        currentUserId,
      );
      throw new ServiceUnavailableException(
        'Partner discovery is temporarily unavailable',
      );
    }
  }

  async getAudioIntros(
    currentUserId: string,
    currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const seriousLearnerOnly =
      query.serious_learner_only === true ||
      query.serious_learner_mode === true ||
      currentUserProfile?.serious_learner_mode === true;
    if (seriousLearnerOnly) {
      query.serious_learner_only = true;
    }
    const seriousLearnerActiveSince = seriousLearnerOnly
      ? getSeriousLearnerActiveSince()
      : null;

    // Apply VIP country/city spoofing
    if (currentUserProfile?.is_vip) {
      if (currentUserProfile.mock_country) {
        query.country = currentUserProfile.mock_country;
      }
      if (currentUserProfile.mock_city) {
        query.city = currentUserProfile.mock_city;
      }
    }

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null);

    queryBuilder = queryBuilder
      .not('audio_intro_url', 'is', null)
      .neq('audio_intro_url', '');

    if (blockedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', blockedIds);
    }

    if (query.native_languages) {
      queryBuilder = queryBuilder.contains('native_languages', [
        query.native_languages,
      ]);
    }

    if (query.target_language) {
      queryBuilder = queryBuilder.contains('target_languages', [
        query.target_language,
      ]);
    }

    if (seriousLearnerOnly && seriousLearnerActiveSince) {
      queryBuilder = queryBuilder
        .gte('study_streak_days', SERIOUS_LEARNER_MIN_STREAK_DAYS)
        .gte('last_active_at', seriousLearnerActiveSince);
    }

    if (query.level) {
      queryBuilder = queryBuilder.eq('proficiency_level', query.level);
    }

    if (query.age_min !== undefined) {
      queryBuilder = queryBuilder.gte('age', query.age_min);
    }
    if (query.age_max !== undefined) {
      queryBuilder = queryBuilder.lte('age', query.age_max);
    }

    if (query.country) {
      queryBuilder = queryBuilder.ilike('country', `%${query.country}%`);
    }
    if (query.city) {
      queryBuilder = queryBuilder.ilike('city', `%${query.city}%`);
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data) {
      const errorCode =
        response.error?.code?.match(/^[a-z0-9_-]{1,32}$/i)?.[0] ?? 'unknown';
      this.logger.error({ errorCode }, 'Audio intro discovery query failed');
      throw new ServiceUnavailableException(
        'Audio introductions are temporarily unavailable',
      );
    }
    let results = response.data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }
    // Apply voice room active filter
    results = await this.filterByVoiceRoomActive(
      results,
      query.voice_room_active === true,
    );
    return sanitiseDiscoveryData(results);
  }

  async getRecentNativeSpeakers(currentUserId: string): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .gt('created_at', sevenDaysAgo.toISOString())
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null)
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      return sanitiseDiscoveryData([]);
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }

    // Attach Partner of the Week flag
    try {
      const rawPoW = await this.supabaseService
        .getRedisClient()
        .get('partner_of_week_ids');
      const partnerIds = this.parseStringArray(rawPoW);
      const partnerSet = new Set(partnerIds);
      results = results.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
    } catch {
      // Continue without PoW flag if Redis is unavailable
    }

    return sanitiseDiscoveryData(results);
  }

  async getSpotlightUsers(currentUserId: string): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const { data, error } = await supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null)
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data) {
      return sanitiseDiscoveryData([]);
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }

    // Attach Partner of the Week flag
    try {
      const rawPoW = await this.supabaseService
        .getRedisClient()
        .get('partner_of_week_ids');
      const partnerIds = this.parseStringArray(rawPoW);
      const partnerSet = new Set(partnerIds);
      results = results.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
    } catch {
      // Continue without PoW flag if Redis is unavailable
    }

    return sanitiseDiscoveryData(results);
  }

  async findByLanguagePair(
    currentUserId: string,
    query: LanguagePairQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const {
      native_language,
      target_language,
      page = 0,
      limit = 50,
      sort = 'best_match',
    } = query;
    const offset = page * limit;

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
        { count: 'exact', head: false },
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null);

    if (blockedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', blockedIds);
    }

    if (query.has_audio_intro) {
      queryBuilder = queryBuilder
        .not('audio_intro_url', 'is', null)
        .neq('audio_intro_url', '');
    }

    if (query.country) {
      queryBuilder = queryBuilder.ilike('country', `%${query.country}%`);
    }
    if (query.city) {
      queryBuilder = queryBuilder.ilike('city', `%${query.city}%`);
    }

    if (query.level) {
      queryBuilder = queryBuilder.eq('proficiency_level', query.level);
    }

    const nativeLang = native_language;
    const targetLang = target_language;

    if (nativeLang && targetLang) {
      queryBuilder = queryBuilder
        .contains('native_languages', [targetLang])
        .contains('target_languages', [nativeLang]);
    } else if (nativeLang) {
      queryBuilder = queryBuilder.contains('native_languages', [nativeLang]);
    } else if (targetLang) {
      queryBuilder = queryBuilder.contains('target_languages', [targetLang]);
    }

    // Apply ordering based on sort parameter
    if (sort === 'newest') {
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
    } else {
      // best_match (default) and fallback: high streak days first, then correction ratio
      queryBuilder = queryBuilder
        .order('study_streak_days', { ascending: false })
        .order('correction_ratio', { ascending: false });
    }

    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const response = await queryBuilder;
    if (response.error || !response.data) {
      throw new ServiceUnavailableException(
        'Partner discovery is temporarily unavailable',
      );
    }

    let results = response.data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }

    // Attach Partner of the Week flag
    let partnerSet = new Set<string>();
    try {
      const rawPoW = await redis.get('partner_of_week_ids');
      const partnerIds = this.parseStringArray(rawPoW);
      partnerSet = new Set(partnerIds);
    } catch {
      // Continue without PoW flag if Redis is unavailable
    }
    results = results.map((u) => ({
      ...u,
      is_partner_of_week: partnerSet.has(u.id),
    }));

    // For best_match, promote partner of week first, then maintain db order
    if (sort === 'best_match') {
      // In findByLanguagePair, we don't have current user profile handy, but we will sort based on what we can.
      results.forEach((u) => {
        const matchData = this.calculateMatchScore(null, u);
        u.match_reasons = matchData.reasons;
        u._matchScore = matchData.score;
      });
      results.sort((a, b) => {
        const aPow = a.is_partner_of_week ? 1 : 0;
        const bPow = b.is_partner_of_week ? 1 : 0;
        if (aPow !== bPow) return bPow - aPow;

        const scoreA = a._matchScore ?? 0;
        const scoreB = b._matchScore ?? 0;
        return scoreB - scoreA;
      });
    }

    // Apply voice room active filter
    results = await this.filterByVoiceRoomActive(
      results,
      query.voice_room_active === true,
    );

    return sanitiseDiscoveryData(results);
  }

  private async filterByVoiceRoomActive<T extends UserProfile>(
    users: T[],
    voiceRoomActive: boolean,
  ): Promise<T[]> {
    if (!voiceRoomActive) return users;
    try {
      const activeHostIds = await this.audioRoomsService.getActiveHostIds();
      const activeHostSet = new Set(activeHostIds);
      return users.filter((u) => activeHostSet.has(u.id));
    } catch (err) {
      this.logger.error(
        'Voice room active filter failed, returning no active hosts',
        err,
      );
      return [];
    }
  }

  private applyAdvancedFilters(
    users: UserProfile[],
    query: SearchQueryDto,
  ): UserProfile[] {
    let result = users as DiscoveryUser[];

    if (query.learning_goals) {
      const goalList = query.learning_goals
        .split(',')
        .map((g) => g.trim().toLowerCase());
      result = result.filter((u) => {
        const userGoals: string[] = u.learning_goals ?? [];
        const lowerUserGoals = userGoals.map((g) => g.toLowerCase());
        return goalList.some((g) => lowerUserGoals.includes(g));
      });
    }

    const checkAvailability = (
      field:
        | 'availability_morning'
        | 'availability_afternoon'
        | 'availability_evening',
    ): boolean => query[field] ?? false;

    if (checkAvailability('availability_morning')) {
      result = result.filter((u) => u.availability_morning === true);
    }
    if (checkAvailability('availability_afternoon')) {
      result = result.filter((u) => u.availability_afternoon === true);
    }
    if (checkAvailability('availability_evening')) {
      result = result.filter((u) => u.availability_evening === true);
    }

    // Exact availability time overlap filtering (Tandem‑style)
    if (query.available_time_start && query.available_time_end) {
      const qStart = query.available_time_start; // HH:mm
      const qEnd = query.available_time_end;

      result = result.filter((u) => {
        const uStart: string | undefined = u.available_time_start;
        const uEnd: string | undefined = u.available_time_end;
        if (!uStart || !uEnd) {
          // user has no exact times set – treat as always available
          return true;
        }
        // Overlap test: start1 <= end2 && start2 <= end1
        return uStart <= qEnd && uEnd >= qStart;
      });
    }

    return result;
  }

  private calculateMatchScore(
    searcher: UserProfile | null,
    candidate: DiscoveryUser,
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Helper: basic overlap check
    const hasOverlap = (left?: string[] | null, right?: string[] | null) => {
      if (!left || !right || left.length === 0 || right.length === 0)
        return false;
      const rightSet = new Set(right);
      return left.some((l) => rightSet.has(l));
    };

    if (searcher) {
      // A. Complementary Languages (Reciprocity)
      const mutualMatch =
        hasOverlap(candidate.native_languages, searcher.target_languages) &&
        hasOverlap(candidate.target_languages, searcher.native_languages);
      const oneWayMatch =
        hasOverlap(candidate.native_languages, searcher.target_languages) ||
        hasOverlap(candidate.target_languages, searcher.native_languages);

      if (mutualMatch) {
        score += 50;
        reasons.push('language_exchange');
      } else if (oneWayMatch) {
        score += 20;
        reasons.push('one_way_language_exchange');
      }

      // B. Proficiency Level Gap
      if (
        searcher.proficiency_level &&
        candidate.proficiency_level &&
        searcher.proficiency_level === candidate.proficiency_level
      ) {
        score += 10;
        reasons.push('similar_proficiency');
      }

      // D. Interest Overlap
      if (searcher.interests && candidate.interests) {
        const searcherInterestsSet = new Set(searcher.interests);
        let sharedInterests = 0;
        for (const interest of candidate.interests) {
          if (searcherInterestsSet.has(interest)) {
            sharedInterests++;
          }
        }
        if (sharedInterests > 0) {
          score += sharedInterests * 10;
          reasons.push('shared_interests');
        }
      }

      // G. Learning Seriousness
      if (searcher.is_serious_learner && candidate.study_streak_days) {
        score += Math.min(candidate.study_streak_days, 50);
        reasons.push('study_streak');
      }
    }

    // F. Correction Behaviour (Helpfulness)
    if (candidate.correction_ratio) {
      score += candidate.correction_ratio * 40;
      reasons.push('helpful_corrector');
    }

    // C. Timezone / Active Hours Overlap (proxy using recent activity)
    if (candidate.last_active_at) {
      const activeTime = Date.parse(candidate.last_active_at);
      if (Number.isFinite(activeTime)) {
        const ageMs = Math.max(0, Date.now() - activeTime);
        if (ageMs <= 24 * 60 * 60 * 1000) {
          // Active in last day
          score += 10;
          reasons.push('active_recently');
        }
      }
    }

    return { score, reasons };
  }

  private sortUsers(
    users: UserProfile[],
    sort?: string,
    _searchLat?: number,
    _searchLon?: number,
    searcherProfile?: UserProfile | null,
  ): UserProfile[] {
    if (!sort || !users.length) return users;
    const discoveryUsers = users as DiscoveryUser[];
    switch (sort) {
      case 'best_match':
        discoveryUsers.forEach((u) => {
          if (searcherProfile) {
            const matchData = this.calculateMatchScore(searcherProfile, u);
            u.match_reasons = matchData.reasons;
            u._matchScore = matchData.score;
          } else {
            const matchData = this.calculateMatchScore(null, u);
            u.match_reasons = matchData.reasons;
            u._matchScore = matchData.score;
          }
        });
        return discoveryUsers.sort((a, b) => {
          const aPow = a.is_partner_of_week ? 1 : 0;
          const bPow = b.is_partner_of_week ? 1 : 0;
          if (aPow !== bPow) return bPow - aPow;

          const scoreA = a._matchScore ?? 0;
          const scoreB = b._matchScore ?? 0;
          return scoreB - scoreA;
        });
      case 'online_now':
        return discoveryUsers.sort((a, b) => {
          const aDate = a.last_active_at ?? '';
          const bDate = b.last_active_at ?? '';
          return bDate.localeCompare(aDate);
        });
      case 'nearest':
        return discoveryUsers.sort((a, b) => {
          const aDist = a.distance_metres ?? Number.MAX_VALUE;
          const bDist = b.distance_metres ?? Number.MAX_VALUE;
          if (aDist !== bDist) return aDist - bDist;
          return 0;
        });
      case 'newest':
        return discoveryUsers.sort((a, b) => {
          const aDate = a.created_at ?? '';
          const bDate = b.created_at ?? '';
          return bDate.localeCompare(aDate);
        });
      default:
        return users;
    }
  }

  async searchByCountryCity(
    currentUserId: string,
    query: { country?: string; city?: string },
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);
    let qb = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .is('scheduled_for_deletion_at', null);
    if (blockedIds.length > 0) {
      qb = qb.not('id', 'in', blockedIds);
    }
    if (query.country) {
      qb = qb.ilike('country', `%${query.country}%`);
    }
    if (query.city) {
      qb = qb.ilike('city', `%${query.city}%`);
    }
    const { data, error } = await qb.limit(50);
    if (error || !data) {
      return sanitiseDiscoveryData([]);
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      results = results.filter((u) => !blockedSet.has(u.id));
    }
    return sanitiseDiscoveryData(results);
  }

  private parseStringArray(raw: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === 'string',
        );
      }
    } catch {
      return [];
    }
    return [];
  }
}
