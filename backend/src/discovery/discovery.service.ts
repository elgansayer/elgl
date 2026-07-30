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

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations() {
    this.logger.log('Starting daily partner recommendations calculation...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    try {
      // Fetch active users to generate recommendations for
      // In a production app with millions of users, this would be batched/paginated
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

        // Find users who speak this user's target language natively
        // and are learning this user's native language (Language Exchange Match)
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
          // Exclude blocked users
          const blockedIds = await this.safetyService.getBlockedAndBlockerIds(
            user.id,
          );
          if (blockedIds.length > 0) {
            matchIds = matchIds.filter((id) => !blockedIds.includes(id));
          }
          if (matchIds.length > 0) {
            // Cache recommendations in Redis for 24 hours (86400 seconds)
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

  async searchPartners(
    currentUserId: string,
    _currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from search
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    let searchLat = query.latitude;
    let searchLon = query.longitude;

    // Use mock location if user is VIP and has it set
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

    // Exclude blocked users
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

    // Age range filter
    if (query.age_min !== undefined) {
      queryBuilder = queryBuilder.gte('age', query.age_min);
    }
    if (query.age_max !== undefined) {
      queryBuilder = queryBuilder.lte('age', query.age_max);
    }

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
          return this.filterByVoiceRoomActive(
            mockData,
            query.voice_room_active === true,
          );
        }
        // Filter fallback results for blocked users
        let fallbackResults = fallbackRes.data as UserProfile[];
        if (blockedIds.length > 0) {
          fallbackResults = fallbackResults.filter(
            (u) => !blockedIds.includes(u.id),
          );
        }
        // Filter by proficiency level
        if (query.level) {
          fallbackResults = fallbackResults.filter(
            (u: any) => u.proficiency_level === query.level,
          );
        }
        // Age range filter for fallback results
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
        return this.filterByVoiceRoomActive(
          fallbackResults,
          query.voice_room_active === true,
        );
      }
      // Filter RPC results for blocked users
      let rpcResults = response.data as UserProfile[];
      if (blockedIds.length > 0) {
        rpcResults = rpcResults.filter((u) => !blockedIds.includes(u.id));
      }
      // Filter by proficiency level
      if (query.level) {
        // RPC results may not include proficiency_level, fetch explicitly
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
        // Fetch interests column and filter client‑side
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
        } else {
          // rpcResults empty after level filter, nothing to do
        }
      }
      if (_currentUserProfile?.is_vip && query.gender) {
        rpcResults = rpcResults.filter(
          (u) => (u as any).gender === query.gender,
        );
      }
      // Age range filter for RPC results
      if (query.age_min !== undefined) {
        rpcResults = rpcResults.filter((u) => (u as any).age >= query.age_min);
      }
      if (query.age_max !== undefined) {
        rpcResults = rpcResults.filter((u) => (u as any).age <= query.age_max);
      }
      return this.filterByVoiceRoomActive(
        rpcResults,
        query.voice_room_active === true,
      );
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data || response.data.length === 0) {
      const mockData = this.getMockDiscoveryData(query, blockedIds);
      return this.filterByVoiceRoomActive(
        mockData,
        query.voice_room_active === true,
      );
    }
    // Filter results for blocked users
    let results = response.data as UserProfile[];
    // Voice room active filter (if requested)
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    // Filter by proficiency level
    if (query.level) {
      results = results.filter((u: any) => u.proficiency_level === query.level);
    }
    // Age range filter for query results
    if (query.age_min !== undefined) {
      results = results.filter((u) => (u as any).age >= query.age_min);
    }
    if (query.age_max !== undefined) {
      results = results.filter((u) => (u as any).age <= query.age_max);
    }
    return this.filterByVoiceRoomActive(
      results,
      query.voice_room_active === true,
    );
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

    // Filter out blocked users
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

    // Age range filter for mock data
    if (query.age_min !== undefined) {
      filtered = filtered.filter((u) => (u as any).age >= query.age_min);
    }
    if (query.age_max !== undefined) {
      filtered = filtered.filter((u) => (u as any).age <= query.age_max);
    }

    // Filter by proficiency level
    if (query.level) {
      filtered = filtered.filter(
        (u: any) => u.proficiency_level === query.level,
      );
    }

    // Filter by interests
    if (query.interests) {
      filtered = filtered.filter((u: any) =>
        u.interests?.includes(query.interests),
      );
    }

    // Limit to 50
    return filtered.slice(0, 50) as unknown as UserProfile[];
  }
}
