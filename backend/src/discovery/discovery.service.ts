import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { LanguagePairQueryDto } from './dto/language-pair-query.dto';
import { MOCK_USERS } from '../mock-data';

@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  constructor(
    private readonly audioRoomsService: AudioRoomsService,
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

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_languages, target_languages')
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
            await redis.set(
              `daily_recommendations:${user.id}`,
              JSON.stringify(matchIds),
              'EX',
              86400,
            );
          }
        }
      }
      this.logger.log('Finished daily partner recommendations calculation.');
    } catch (err) {
      this.logger.error('Error calculating daily recommendations', err);
    }
  }

  // Expose the current Partner of the Week IDs
  async getPartnerOfWeekIds(): Promise<string[]> {
    const redis = this.supabaseService.getRedisClient();
    const raw = await redis.get('partner_of_week_ids');
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  async searchPartners(
    currentUserId: string,
    _currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

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
      .eq('privacy_hide_from_search', false);

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
      queryBuilder = queryBuilder.eq('country', query.country);
    }
    if (query.city) {
      queryBuilder = queryBuilder.eq('city', query.city);
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
      let partnerIds: string[] = [];
      if (raw) {
        try {
          partnerIds = JSON.parse(raw);
        } catch {
          /* ignore */
        }
      }
      const partnerSet = new Set(partnerIds);
      const enriched = filtered.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
      return this.sortUsers(enriched, query.sort);
    };

    if (searchLat !== undefined && searchLon !== undefined) {
      const response = await supabase.rpc('search_nearby_users', {
        search_lat: searchLat,
        search_lon: searchLon,
        radius_m: query.radius_metres || 50000,
        exclude_user_id: currentUserId,
        filter_native: query.native_languages || null,
        filter_target: query.target_language || null,
        serious_only: Boolean(query.serious_learner_only),
      });

      if (
        response.error ||
        !response.data ||
        (response.data as any[]).length === 0
      ) {
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
        let fallbackResults: UserProfile[] = (fallbackRes.data as any[]).map(
          (item: any) => ({
            ...item,
            distance_metres: undefined,
          }),
        );
        if (blockedIds.length > 0) {
          fallbackResults = fallbackResults.filter(
            (u) => !blockedIds.includes(u.id),
          );
        }
        if (query.level) {
          fallbackResults = fallbackResults.filter(
            (u: any) => u.proficiency_level === query.level,
          );
        }
        if (query.age_min !== undefined) {
          const ageMin = query.age_min;
          fallbackResults = fallbackResults.filter(
            (u) => (u as any).age >= ageMin,
          );
        }
        if (query.age_max !== undefined) {
          const ageMax = query.age_max;
          fallbackResults = fallbackResults.filter(
            (u) => (u as any).age <= ageMax,
          );
        }
        const filtered = await this.filterByVoiceRoomActive(
          fallbackResults,
          query.voice_room_active === true,
        );
        return enrich(filtered);
      }
      let rpcResults: UserProfile[] = (response.data as any[]).map(
        (item: any) => ({
          ...item,
          distance_metres: item.distance_metres ?? item.distance ?? undefined,
        }),
      );
      if (blockedIds.length > 0) {
        rpcResults = rpcResults.filter((u) => !blockedIds.includes(u.id));
      }
      if (query.level) {
        if (rpcResults.length > 0) {
          const { data: levelData } = await supabase
            .from('users')
            .select('id, proficiency_level')
            .in(
              'id',
              rpcResults.map((u: any) => u.id),
            );
          const levelMap = new Map(
            (levelData ?? []).map((u: any) => [u.id, u.proficiency_level]),
          );
          rpcResults = rpcResults.filter(
            (u) => levelMap.get(u.id) === query.level,
          );
        } else {
          rpcResults = rpcResults.filter(
            (u: any) => u.proficiency_level === query.level,
          );
        }
      }
      if (query.interests) {
        if (rpcResults.length > 0) {
          const { data: interestData } = await supabase
            .from('users')
            .select('id, interests')
            .in(
              'id',
              rpcResults.map((u: any) => u.id),
            );
          const interestMap = new Map<string, string[]>(
            (interestData ?? []).map((u: any) => [u.id, u.interests ?? []]),
          );
          rpcResults = rpcResults.filter((u) =>
            interestMap.get(u.id)?.includes(query.interests!),
          );
        }
      }
      if (_currentUserProfile?.is_vip && query.gender) {
        rpcResults = rpcResults.filter(
          (u) => (u as any).gender === query.gender,
        );
      }
      if (query.age_min !== undefined) {
        const ageMin = query.age_min;
        rpcResults = rpcResults.filter((u) => (u as any).age >= ageMin);
      }
      if (query.age_max !== undefined) {
        const ageMax = query.age_max;
        rpcResults = rpcResults.filter((u) => (u as any).age <= ageMax);
      }

      if (query.has_audio_intro) {
        rpcResults = rpcResults.filter(
          (u) => u.audio_intro_url && u.audio_intro_url.trim() !== '',
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
    let results: UserProfile[] = (response.data as any[]).map((item: any) => ({
      ...item,
      distance_metres: item.distance_metres ?? item.distance ?? undefined,
    }));
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    if (query.level) {
      results = results.filter((u: any) => u.proficiency_level === query.level);
    }
    if (query.age_min !== undefined) {
      const ageMin = query.age_min;
      results = results.filter((u) => (u as any).age >= ageMin);
    }
    if (query.age_max !== undefined) {
      const ageMax = query.age_max;
      results = results.filter((u) => (u as any).age <= ageMax);
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
      .not('audio_intro_url', 'is', null)
      .neq('audio_intro_url', '');

    if (blockedIds.length > 0) {
      queryBuilder = (queryBuilder as any).not('id', 'in', blockedIds);
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
      queryBuilder = queryBuilder.eq('country', query.country);
    }
    if (query.city) {
      queryBuilder = queryBuilder.eq('city', query.city);
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data) {
      return [];
    }
    let results = response.data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
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
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data) {
      return [];
    }
    let results = data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await this.supabaseService
      .getRedisClient()
      .get('partner_of_week_ids');
    let partnerSet = new Set<string>();
    if (rawPoW) {
      try {
        partnerSet = new Set(JSON.parse(rawPoW));
      } catch {
        /* ignore */
      }
    }
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
      .not('native_languages', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data) {
      return [];
    }
    let results = data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await this.supabaseService
      .getRedisClient()
      .get('partner_of_week_ids');
    let partnerSet = new Set<string>();
    if (rawPoW) {
      try {
        partnerSet = new Set(JSON.parse(rawPoW));
      } catch {
        /* ignore */
      }
    }
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
      .eq('privacy_hide_from_search', false);

    if (blockedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', blockedIds);
    }

    if (query.has_audio_intro) {
      queryBuilder = queryBuilder
        .not('audio_intro_url', 'is', null)
        .neq('audio_intro_url', '');
    }

    if (query.country) {
      queryBuilder = queryBuilder.eq('country', query.country);
    }
    if (query.city) {
      queryBuilder = queryBuilder.eq('city', query.city);
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
        level: undefined,
        interests: undefined,
        latitude: undefined,
        longitude: undefined,
        radius_metres: undefined,
        sort: sort,
        voice_room_active: undefined,
        country: query.country,
        city: query.city,
      };
      const mock = this.getMockDiscoveryData(mockSearch, blockedIds);
      return mock.slice(offset, offset + limit);
    }

    let results = response.data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }

    // Attach Partner of the Week flag
    const rawPoW = await redis.get('partner_of_week_ids');
    let partnerSet = new Set<string>();
    if (rawPoW) {
      try {
        partnerSet = new Set(JSON.parse(rawPoW));
      } catch {
        /* ignore */
      }
    }
    results = results.map((u) => ({
      ...u,
      is_partner_of_week: partnerSet.has(u.id),
    }));

    // For best_match, promote partner of week first, then maintain db order
    if (sort === 'best_match') {
      results.sort((a, b) => {
        const aPoW = (a as any).is_partner_of_week ? 1 : 0;
        const bPoW = (b as any).is_partner_of_week ? 1 : 0;
        if (aPoW !== bPoW) return bPoW - aPoW;
        const streakA = a.study_streak_days ?? 0;
        const streakB = b.study_streak_days ?? 0;
        if (streakB !== streakA) return streakB - streakA;
        const ratioA = a.correction_ratio ?? 0;
        const ratioB = b.correction_ratio ?? 0;
        return ratioB - ratioA;
      });
    }

    return results;
  }

  private async filterByVoiceRoomActive(
    users: UserProfile[],
    voiceRoomActive: boolean,
  ): Promise<UserProfile[]> {
    if (!voiceRoomActive) return users;
    const activeHostIds = await this.audioRoomsService.getActiveHostIds();
    return users.filter((u) => activeHostIds.includes(u.id));
  }

  private getMockDiscoveryData(
    query: SearchQueryDto,
    blockedIds: string[] = [],
  ): UserProfile[] {
    let filtered = MOCK_USERS;

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
      filtered = filtered.filter((u) => (u as any).age >= ageMin);
    }
    if (query.age_max !== undefined) {
      const ageMax = query.age_max;
      filtered = filtered.filter((u) => (u as any).age <= ageMax);
    }

    if (query.level) {
      filtered = filtered.filter(
        (u: any) => u.proficiency_level === query.level,
      );
    }

    if (query.interests) {
      filtered = filtered.filter((u: any) =>
        u.interests?.includes(query.interests),
      );
    }

    if (query.has_audio_intro) {
      filtered = filtered.filter(
        (u: any) => u.audio_intro_url && u.audio_intro_url !== '',
      );
    }

    if (query.country) {
      filtered = filtered.filter((u: any) => u.country === query.country);
    }
    if (query.city) {
      filtered = filtered.filter((u: any) => u.city === query.city);
    }

    return filtered.slice(0, 50) as unknown as UserProfile[];
  }

  private applyAdvancedFilters(
    users: UserProfile[],
    query: SearchQueryDto,
  ): UserProfile[] {
    let result = users;

    if (query.learning_goals) {
      const goalList = query.learning_goals
        .split(',')
        .map((g) => g.trim().toLowerCase());
      result = result.filter((u) => {
        const userGoals: string[] = (u as any).learning_goals ?? [];
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
      result = result.filter((u) => (u as any).availability_morning === true);
    }
    if (checkAvailability('availability_afternoon')) {
      result = result.filter((u) => (u as any).availability_afternoon === true);
    }
    if (checkAvailability('availability_evening')) {
      result = result.filter((u) => (u as any).availability_evening === true);
    }

    // Exact availability time overlap filtering (Tandem‑style)
    if (query.available_time_start && query.available_time_end) {
      const qStart = query.available_time_start; // HH:mm
      const qEnd = query.available_time_end;

      result = result.filter((u) => {
        const uStart: string | undefined = (u as any).available_time_start;
        const uEnd: string | undefined = (u as any).available_time_end;
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
    searchLat?: number,
    searchLon?: number,
  ): UserProfile[] {
    if (!sort || !users.length) return users;
    switch (sort) {
      case 'best_match':
        return users.sort((a, b) => {
          const aPow = (a as any).is_partner_of_week ? 1 : 0;
          const bPow = (b as any).is_partner_of_week ? 1 : 0;
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
        return users.sort((a, b) => {
          const aDate = (a as any).last_active_at ?? '';
          const bDate = (b as any).last_active_at ?? '';
          return bDate.localeCompare(aDate);
        });
      case 'nearest':
        return users.sort((a, b) => {
          const aDist = (a as any).distance ?? Number.MAX_VALUE;
          const bDist = (b as any).distance ?? Number.MAX_VALUE;
          if (aDist !== bDist) return aDist - bDist;
          return 0;
        });
      case 'newest':
        return users.sort((a, b) => {
          const aDate = a.created_at ?? '';
          const bDate = b.created_at ?? '';
          return bDate.localeCompare(aDate);
        });
      default:
        return users;
    }
  }
}
