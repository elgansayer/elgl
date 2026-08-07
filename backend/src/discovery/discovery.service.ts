import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { CloudflareCacheService } from '../cloudflare/cache.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { DISCOVERY_CACHE_TAG_POTW } from './cache.interceptor';
import { MOCK_USERS } from '../mock-data';

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

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly audioRoomsService: AudioRoomsService,
    private readonly cloudflareCacheService: CloudflareCacheService,
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  // Weekly computation of Partner of the Week (every Sunday at midnight)
  @Cron('0 0 * * 0')
  async calculatePartnerOfWeek(): Promise<void> {
    this.logger.log('Starting Partner of the Week calculation...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    try {
      const { data: topUsers, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_deletion_pending', false)
        .gt('correction_ratio', 0.5)
        .order('correction_ratio', { ascending: false })
        .order('study_streak_days', { ascending: false })
        .limit(10);

      if (error || !topUsers || topUsers.length === 0) {
        this.logger.warn(
          'No users qualified for Partner of the Week',
          error?.message,
        );
        return;
      }

      const partnerIds = topUsers.map((u) => u.id);
      await redis.set(
        'partner_of_week_ids',
        JSON.stringify(partnerIds),
        'EX',
        604800,
      );
      this.logger.log(`Partner of the Week set for ${partnerIds.length} users`);

      // Purge Cloudflare edge cache for the old POTW list across all PoPs
      await this.cloudflareCacheService.purgeByCacheTags([
        DISCOVERY_CACHE_TAG_POTW,
      ]);
    } catch (err) {
      this.logger.error('Error calculating Partner of the Week', err);
    }
  }

  // Daily calculation (existing functionality)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations() {
    this.logger.log('Starting daily partner recommendations calculation...');
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

      for (const user of typedUsers) {
        if (!user.native_languages?.length || !user.target_languages?.length) {
          continue;
        }

        const { data: matches } = await supabase
          .from('users')
          .select('id')
          .neq('id', user.id)
          .eq('privacy_hide_from_search', false)
          .eq('is_deletion_pending', false)
          .contains('native_languages', [user.target_languages[0]])
          .contains('target_languages', [user.native_languages[0]])
          .order('study_streak_days', { ascending: false })
          .limit(10);

        if (matches && matches.length > 0) {
          let matchIds = (matches as Array<{ id: string }>).map((m) => m.id);
          const blockedIds = await this.safetyService.getBlockedAndBlockerIds(
            user.id,
          );
          if (blockedIds.length > 0) {
            matchIds = matchIds.filter((id) => !blockedIds.includes(id));
          }
          if (matchIds.length > 0) {
            pipeline.set(
              `daily_recommendations:${user.id}`,
              JSON.stringify(matchIds),
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

      await flushPipeline();
      this.logger.log(
        `Finished daily partner recommendations calculation. Cached ${totalCached} sets.`,
      );
    } catch (err) {
      await flushPipeline();
      this.logger.error('Error calculating daily recommendations', err);
    }
  }

  // Expose the current Partner of the Week IDs
  async getPartnerOfWeekIds(): Promise<string[]> {
    const redis = this.supabaseService.getRedisClient();
    const raw = await redis.get('partner_of_week_ids');
    return this.parseStringArray(raw);
  }

  async searchPartners(
    currentUserId: string,
    _currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

    // GDPR audit log: record location-based searches for compliance
    if (
      query.latitude !== undefined ||
      query.longitude !== undefined ||
      query.country ||
      query.city
    ) {
      this.logger.log(
        `Discovery location search by user ${currentUserId}: ` +
          `lat=${query.latitude ?? 'none'}, lon=${query.longitude ?? 'none'}, ` +
          `country=${query.country ?? 'none'}, city=${query.city ?? 'none'}`,
      );
    }

    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

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

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at, last_active_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false);

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

    // When the user has serious_learner_mode enabled, force serious learner filter
    if (_currentUserProfile?.is_serious_learner || query.serious_learner_mode) {
      query.serious_learner_only = true;
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
        filtered = this.applyAdvancedFilters(filtered, query);
      }
      const raw = await this.supabaseService
        .getRedisClient()
        .get('partner_of_week_ids');
      const partnerIds = this.parseStringArray(raw);
      const partnerSet = new Set(partnerIds);
      const enriched = filtered.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
      return this.sortUsers(enriched, query.sort);
    };

    if (searchLat !== undefined && searchLon !== undefined) {
      const response = (await supabase.rpc('search_nearby_users', {
        search_lat: searchLat,
        search_lon: searchLon,
        radius_m: query.radius_metres || 50000,
        exclude_user_id: currentUserId,
        filter_native_arr: query.native_languages ? [query.native_languages] : null,
        filter_target: query.target_language || null,
        serious_only: Boolean(query.serious_learner_only),
        filter_level: query.level || null,
        filter_gender: _currentUserProfile?.is_vip && query.gender ? query.gender : null,
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
          fallbackResults = fallbackResults.filter(
            (u) => !blockedIds.includes(u.id),
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
        rpcResults = rpcResults.filter((u) => !blockedIds.includes(u.id));
      }
      // RPC now handles level, gender, age, and audio_intro filters natively,
      // but interests still needs post-processing since the RPC returns interests column
      if (query.interests) {
        rpcResults = rpcResults.filter(
          (u) => u.interests?.includes(query.interests!),
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
      results = results.filter((u) => !blockedIds.includes(u.id));
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
      .eq('is_deletion_pending', false);

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
      return [];
    }
    let results = response.data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    // Apply voice room active filter
    results = await this.filterByVoiceRoomActive(
      results,
      query.voice_room_active === true,
    );
    return results;
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
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      return [];
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await this.supabaseService
      .getRedisClient()
      .get('partner_of_week_ids');
    const partnerIds = this.parseStringArray(rawPoW);
    const partnerSet = new Set(partnerIds);
    results = results.map((u) => ({
      ...u,
      is_partner_of_week: partnerSet.has(u.id),
    }));

    return results;
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
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data) {
      return [];
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await this.supabaseService
      .getRedisClient()
      .get('partner_of_week_ids');
    const partnerIds = this.parseStringArray(rawPoW);
    const partnerSet = new Set(partnerIds);
    results = results.map((u) => ({
      ...u,
      is_partner_of_week: partnerSet.has(u.id),
    }));

    return results;
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
      .eq('is_deletion_pending', false);

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
      return mock.slice(offset, offset + limit);
    }

    let results = response.data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await redis.get('partner_of_week_ids');
    const partnerIds = this.parseStringArray(rawPoW);
    const partnerSet = new Set(partnerIds);
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

    return results;
  }

  private async filterByVoiceRoomActive<T extends UserProfile>(
    users: T[],
    voiceRoomActive: boolean,
  ): Promise<T[]> {
    if (!voiceRoomActive) return users;
    const activeHostIds = await this.audioRoomsService.getActiveHostIds();
    return users.filter((u) => activeHostIds.includes(u.id));
  }

  private getMockDiscoveryData(
    query: SearchQueryDto,
    blockedIds: string[] = [],
  ): UserProfile[] {
    let filtered = MOCK_USERS as unknown as DiscoveryUser[];

    if (blockedIds.length > 0) {
      filtered = filtered.filter((u) => !blockedIds.includes(u.id));
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
    // GDPR audit log: record location search for compliance
    this.logger.log(
      `Discovery country/city search by user ${currentUserId}: ` +
        `country=${query.country ?? 'none'}, city=${query.city ?? 'none'}`,
    );

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
      .eq('is_deletion_pending', false);
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
      return [];
    }
    let results = data as unknown as DiscoveryUser[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    return results;
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
