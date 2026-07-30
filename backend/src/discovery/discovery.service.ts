import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AudioRoomsService } from '../audio-rooms/audio-rooms.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
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

    const mockLocation = _currentUserProfile?.mock_location as
      { coordinates?: number[] } | undefined;
    if (
      _currentUserProfile?.is_vip &&
      mockLocation?.coordinates &&
      Array.isArray(mockLocation.coordinates)
    ) {
      const coords = mockLocation.coordinates;
      searchLon = coords[0];
      searchLat = coords[1];
    }

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false);

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

    // Function that enriches and sorts results with Partner of the Week flag
    const enrich = async (users: UserProfile[]): Promise<UserProfile[]> => {
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
      const enriched = users.map((u) => ({
        ...u,
        is_partner_of_week: partnerSet.has(u.id),
      }));
      enriched.sort((a, b) => {
        if (a.is_partner_of_week && !b.is_partner_of_week) return -1;
        if (!a.is_partner_of_week && b.is_partner_of_week) return 1;
        return 0;
      });
      return enriched;
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
        let fallbackResults = fallbackRes.data as UserProfile[];
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
          fallbackResults = fallbackResults.filter(
            (u) => (u as any).age >= query.age_min,
          );
        }
        if (query.age_max !== undefined) {
          fallbackResults = fallbackResults.filter(
            (u) => (u as any).age <= query.age_max,
          );
        }
        const filtered = await this.filterByVoiceRoomActive(
          fallbackResults,
          query.voice_room_active === true,
        );
        return enrich(filtered);
      }
      let rpcResults = response.data as UserProfile[];
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
        rpcResults = rpcResults.filter((u) => (u as any).age >= query.age_min);
      }
      if (query.age_max !== undefined) {
        rpcResults = rpcResults.filter((u) => (u as any).age <= query.age_max);
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
    let results = response.data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    if (query.level) {
      results = results.filter((u: any) => u.proficiency_level === query.level);
    }
    if (query.age_min !== undefined) {
      results = results.filter((u) => (u as any).age >= query.age_min);
    }
    if (query.age_max !== undefined) {
      results = results.filter((u) => (u as any).age <= query.age_max);
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

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_languages, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, proficiency_level, created_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false)
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
      filtered = filtered.filter((u) => (u as any).age >= query.age_min);
    }
    if (query.age_max !== undefined) {
      filtered = filtered.filter((u) => (u as any).age <= query.age_max);
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

    return filtered.slice(0, 50) as unknown as UserProfile[];
  }
}
