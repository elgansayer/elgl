import {
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { MOCK_USERS } from '../mock-data';
import {
  DiscoveryDegradationService,
  DegradationMarker,
} from './discovery-degradation.service';
import { sanitiseDiscoveryData } from './sanitise-discovery.helper';
import { CorrectorScoreService } from '../corrector-score/corrector-score.service';

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
};

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
  //      and at least a 7-day study streak, ordered by descending correction_ratio (top 50).
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
      // Step 1: Keep the weekly highlight inside the same core visibility boundary
      // as ordinary discovery: hidden or deletion-pending accounts must never be
      // surfaced, and incomplete profiles are not useful recommendations.
      const { data: candidates, error } = await supabase
        .from('users')
        .select(
          'id, display_name, native_languages, target_languages, privacy_hide_from_search, is_deletion_pending, scheduled_for_deletion_at, correction_ratio, study_streak_days',
        )
        .eq('privacy_hide_from_search', false)
        .eq('is_deletion_pending', false)
        .is('scheduled_for_deletion_at', null)
        .not('display_name', 'is', null)
        .not('native_languages', 'is', null)
        .not('target_languages', 'is', null)
        .gt('correction_ratio', 0.5)
        .gte('study_streak_days', 7)
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
          (candidate.study_streak_days ?? 0) >= 7,
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

  // Daily calculation (existing functionality)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations() {
    this.logger.info('Starting daily partner recommendations calculation...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    let pipeline = redis.pipeline();
    let pipelineOps = 0;
    let totalCached = 0;

    const flushPipeline = async (): Promise<void> => {
      if (pipelineOps > 0) {
        await pipeline.exec();
        pipeline = redis.pipeline();
        pipelineOps = 0;
      }
    };

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_languages, target_languages')
        .eq('is_deletion_pending', false)
        .is('scheduled_for_deletion_at', null)
        .not('native_languages', 'is', null)
        .not('target_languages', 'is', null)
        .limit(1000);

      if (error || !users) {
        this.logger.error('Failed to fetch users for recommendations', error);
        return;
      }

      const typedUsers = users as Array<{
        id: string;
        native_languages: string[];
        target_languages: string[];
      }>;

      // Collect unique language pairs to batch query, avoiding N+1 queries
      const pairSet = new Set<string>();
      const pairIndex = new Map<
        string,
        Array<{ userId: string; nativeLang: string; targetLang: string }>
      >();

      for (const user of typedUsers) {
        if (!user.native_languages?.length || !user.target_languages?.length) {
          continue;
        }
        const native = user.native_languages[0];
        const target = user.target_languages[0];
        const key = `${target}:${native}`; // matches speak user's target natively AND are learning user's native
        pairSet.add(key);
        const bucket = pairIndex.get(key) ?? [];
        bucket.push({
          userId: user.id,
          nativeLang: native,
          targetLang: target,
        });
        pairIndex.set(key, bucket);
      }

      // Batch-fetch matches for each unique language pair (up to 20 queries in parallel)
      const MAX_PAIR_BATCH = 20;
      const pairs = Array.from(pairSet);
      const batches: string[][] = [];
      for (let i = 0; i < pairs.length; i += MAX_PAIR_BATCH) {
        batches.push(pairs.slice(i, i + MAX_PAIR_BATCH));
      }

      for (const batchPairs of batches) {
        const queries = batchPairs.map((pairKey) => {
          const [targetCode, nativeCode] = pairKey.split(':');
          return supabase
            .from('users')
            .select('id')
            .eq('privacy_hide_from_search', false)
            .eq('is_deletion_pending', false)
            .is('scheduled_for_deletion_at', null)
            .contains('native_languages', [targetCode])
            .contains('target_languages', [nativeCode])
            .order('study_streak_days', { ascending: false })
            .limit(10);
        });

        const results = await Promise.all(queries);

        for (let i = 0; i < batchPairs.length; i++) {
          const pairKey = batchPairs[i];
          const matchesData = results[i];
          if (
            matchesData.error ||
            !matchesData.data ||
            matchesData.data.length === 0
          ) {
            continue;
          }

          const userEntries = pairIndex.get(pairKey) ?? [];
          const matchIds = (matchesData.data as Array<{ id: string }>).map(
            (m) => m.id,
          );

          // ⚡ Bolt Optimization: Replaced sequential awaits in a for...of loop with a concurrent
          // Promise.all batch map to drastically reduce network latency during recommendation generation.
          // Expected impact: N sequential queries become 1 concurrent roundtrip block, reducing worst-case latency significantly.
          const blockedIdsList = await Promise.all(
            userEntries.map((entry) =>
              this.safetyService.getBlockedAndBlockerIds(entry.userId),
            ),
          );

          // Cache the same match list for every user in this pair bucket
          for (let entryIdx = 0; entryIdx < userEntries.length; entryIdx++) {
            const entry = userEntries[entryIdx];
            const blockedIds = blockedIdsList[entryIdx];
            let filtered = matchIds.filter((id) => id !== entry.userId);
            if (blockedIds.length > 0) {
              const blockedSet = new Set(blockedIds);
              filtered = filtered.filter((id) => !blockedSet.has(id));
            }
            const topN = filtered.slice(0, 10);
            if (topN.length > 0) {
              pipeline.set(
                `daily_recommendations:${entry.userId}`,
                JSON.stringify(topN),
                'EX',
                86400,
              );
              pipelineOps++;
              totalCached++;

              if (pipelineOps >= 200) {
                await flushPipeline();
              }
            }
          }
        }
      }

      await flushPipeline();
      this.logger.info(
        `Finished daily partner recommendations calculation. Cached ${totalCached} sets.`,
      );
    } catch (err) {
      await flushPipeline();
      this.logger.error('Error calculating daily recommendations', err);
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

    let searchLat = query.latitude;
    let searchLon = query.longitude;

    // Apply VIP location spoofing – override query coordinates with the user’s mock location
    const profile = _currentUserProfile;
    if (profile?.is_vip) {
      const mock: unknown = profile.mock_location;
      if (
        mock &&
        typeof mock === 'object' &&
        'type' in mock &&
        'coordinates' in mock
      ) {
        const mockObj = mock as { type: string; coordinates: unknown };
        if (
          mockObj.type === 'Point' &&
          Array.isArray(mockObj.coordinates) &&
          mockObj.coordinates.length === 2
        ) {
          const coords = mockObj.coordinates as [number, number];
          if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            searchLon = coords[0];
            searchLat = coords[1];
          }
        }
      }
      // Apply VIP country/city spoofing
      if (profile.mock_country) {
        query.country = profile.mock_country;
      }
      if (profile.mock_city) {
        query.city = profile.mock_city;
      }
    }

    // Serious Learner mode must be resolved before the standard Supabase query
    // is constructed so every discovery path applies the same thresholds.
    if (_currentUserProfile?.is_serious_learner || query.serious_learner_mode) {
      query.serious_learner_only = true;
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

    if (query.serious_learner_only) {
      queryBuilder = queryBuilder
        .gt('study_streak_days', 7)
        .gte('correction_ratio', 0.8);
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
      return sanitiseDiscoveryData(this.sortUsers(enriched, query.sort));
    };

    if (searchLat !== undefined && searchLon !== undefined) {
      const response = (await supabase.rpc('search_nearby_users', {
        search_lat: searchLat,
        search_lon: searchLon,
        radius_m: query.radius_metres || 50000,
        exclude_user_id: currentUserId,
        filter_native_arr: query.native_languages
          ? [query.native_languages]
          : null,
        filter_target: query.target_language || null,
        serious_only: Boolean(query.serious_learner_only),
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

      if (response.error || !response.data || response.data.length === 0) {
        const fallbackRes = await queryBuilder.limit(50);
        if (
          fallbackRes.error ||
          !fallbackRes.data ||
          fallbackRes.data.length === 0
        ) {
          const mockData = this.getMockDiscoveryData(query, blockedIds);
          const filtered = await this.filterByVoiceRoomActive(
            mockData,
            query.voice_room_active === true,
          );
          return enrich(filtered);
        }
        let fallbackResults: DiscoveryUser[] = (
          fallbackRes.data as unknown as DiscoveryUser[]
        ).map((item) => ({
          ...item,
          distance_metres: undefined,
        }));
        if (blockedIds.length > 0) {
          const blockedSet = new Set(blockedIds);
          fallbackResults = fallbackResults.filter(
            (u) => !blockedSet.has(u.id),
          );
        }
        if (query.level) {
          fallbackResults = fallbackResults.filter(
            (u) => u.proficiency_level === query.level,
          );
        }
        if (query.age_min !== undefined) {
          const ageMin = query.age_min;
          fallbackResults = fallbackResults.filter((u) => u.age! >= ageMin);
        }
        if (query.age_max !== undefined) {
          const ageMax = query.age_max;
          fallbackResults = fallbackResults.filter((u) => u.age! <= ageMax);
        }
        const filtered = await this.filterByVoiceRoomActive(
          fallbackResults,
          query.voice_room_active === true,
        );
        return enrich(filtered);
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
      return enrich(filtered);
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data || response.data.length === 0) {
      const mockData = this.getMockDiscoveryData(query, blockedIds);
      const filtered = await this.filterByVoiceRoomActive(
        mockData,
        query.voice_room_active === true,
      );
      return enrich(filtered);
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
        const mockData = this.getMockDiscoveryData(query, blockedIds);
        await this.degradationService.recordDegradationEvent(
          '/discovery/partners',
          marker.reason ?? 'Search failed, using mock data',
          'mock',
          currentUserId,
        );
        return {
          data: mockData,
          marker: {
            degraded: true,
            reason: `${marker.reason ?? 'unknown'}; fell through to mock data`,
            fallbackSource: 'mock',
          },
        };
      }

      return { data: result, marker };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.degradationService.recordDegradationEvent(
        '/discovery/partners',
        message,
        'mock',
        currentUserId,
      );
      const mockData = this.getMockDiscoveryData(query, blockedIds);
      return {
        data: mockData,
        marker: {
          degraded: true,
          reason: message,
          fallbackSource: 'mock',
        },
      };
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

    if (query.serious_learner_only) {
      queryBuilder = queryBuilder
        .gt('study_streak_days', 7)
        .gte('correction_ratio', 0.8);
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
      // Fallback to mock data if query fails
      const mockSearch: Partial<SearchQueryDto> = {
        native_languages: nativeLang,
        target_language: targetLang,
        serious_learner_only: undefined,
        age_min: undefined,
        age_max: undefined,
        level: query.level,
        interests: undefined,
        latitude: undefined,
        longitude: undefined,
        radius_metres: undefined,
        sort: sort,
        voice_room_active: query.voice_room_active,
        country: query.country,
        city: query.city,
      };
      let mock = this.getMockDiscoveryData(mockSearch, blockedIds);
      mock = await this.filterByVoiceRoomActive(
        mock,
        query.voice_room_active === true,
      );
      return sanitiseDiscoveryData(mock.slice(offset, offset + limit));
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
      results.sort((a, b) => {
        const aPoW = a.is_partner_of_week ? 1 : 0;
        const bPoW = b.is_partner_of_week ? 1 : 0;
        if (aPoW !== bPoW) return bPoW - aPoW;
        const streakA = a.study_streak_days ?? 0;
        const streakB = b.study_streak_days ?? 0;
        if (streakB !== streakA) return streakB - streakA;
        const ratioA = a.correction_ratio ?? 0;
        const ratioB = b.correction_ratio ?? 0;
        return ratioB - ratioA;
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
        'Voice room active filter failed, returning unfiltered results',
        err,
      );
      return users;
    }
  }

  private getMockDiscoveryData(
    query: SearchQueryDto,
    blockedIds: string[] = [],
  ): UserProfile[] {
    let filtered = MOCK_USERS as unknown as DiscoveryUser[];

    if (blockedIds.length > 0) {
      const blockedSet = new Set(blockedIds);
      filtered = filtered.filter((u) => !blockedSet.has(u.id));
    }

    if (query.native_languages) {
      filtered = filtered.filter((u) =>
        u.native_languages.includes(query.native_languages!),
      );
    }

    if (query.target_language) {
      filtered = filtered.filter((u) =>
        u.target_languages.includes(query.target_language!),
      );
    }

    if (query.serious_learner_only) {
      filtered = filtered.filter(
        (u) => u.study_streak_days > 7 && u.correction_ratio >= 0.8,
      );
    }

    if (query.age_min !== undefined) {
      const ageMin = query.age_min;
      filtered = filtered.filter((u) => u.age! >= ageMin);
    }
    if (query.age_max !== undefined) {
      const ageMax = query.age_max;
      filtered = filtered.filter((u) => u.age! <= ageMax);
    }

    if (query.level) {
      filtered = filtered.filter((u) => u.proficiency_level === query.level);
    }

    if (query.interests) {
      filtered = filtered.filter((u) =>
        u.interests?.includes(query.interests!),
      );
    }

    if (query.has_audio_intro) {
      filtered = filtered.filter(
        (u) => u.audio_intro_url && u.audio_intro_url !== '',
      );
    }

    if (query.country) {
      const lowerCountry = query.country.toLowerCase();
      filtered = filtered.filter((u) =>
        (u.country ?? '').toLowerCase().includes(lowerCountry),
      );
    }
    if (query.city) {
      const lowerCity = query.city.toLowerCase();
      filtered = filtered.filter((u) =>
        (u.city ?? '').toLowerCase().includes(lowerCity),
      );
    }

    return filtered.slice(0, 50);
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

  private sortUsers(
    users: UserProfile[],
    sort?: string,
    _searchLat?: number,
    _searchLon?: number,
  ): UserProfile[] {
    if (!sort || !users.length) return users;
    const discoveryUsers = users as DiscoveryUser[];
    switch (sort) {
      case 'best_match':
        return discoveryUsers.sort((a, b) => {
          const aPow = a.is_partner_of_week ? 1 : 0;
          const bPow = b.is_partner_of_week ? 1 : 0;
          if (aPow !== bPow) return bPow - aPow;
          const streakA = a.study_streak_days ?? 0;
          const streakB = b.study_streak_days ?? 0;
          if (streakB !== streakA) return streakB - streakA;
          const ratioA = a.correction_ratio ?? 0;
          const ratioB = b.correction_ratio ?? 0;
          if (ratioB !== ratioA) return ratioB - ratioA;
          return 0;
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
