import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from '../safety/safety.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';
import { SearchQueryDto } from './dto/search-query.dto';
import { MOCK_USERS } from '../mock-data';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
  ) {}

  async searchPartners(
    currentUserId: string,
    _currentUserProfile: UserProfile | null,
    query: SearchQueryDto,
  ): Promise<UserProfile[]> {
    const supabase = this.supabaseService.getClient();

    // Get blocked user IDs to exclude from search
    const blockedIds =
      await this.safetyService.getBlockedAndBlockerIds(currentUserId);

    const searchLat = query.latitude;
    const searchLon = query.longitude;

    let queryBuilder = supabase
      .from('users')
      .select(
        'id, display_name, native_language, target_languages, bio_text, avatar_url, audio_intro_url, is_vip, study_streak_days, correction_ratio, is_serious_learner, created_at',
      )
      .neq('id', currentUserId)
      .eq('privacy_hide_from_search', false);

    // Exclude blocked users
    if (blockedIds.length > 0) {
      queryBuilder = queryBuilder.not('id', 'in', `(${blockedIds.join(',')})`);
    }

    if (query.native_language) {
      queryBuilder = queryBuilder.eq('native_language', query.native_language);
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

    if (searchLat !== undefined && searchLon !== undefined) {
      const response = await supabase.rpc('search_nearby_users', {
        search_lat: searchLat,
        search_lon: searchLon,
        radius_m: query.radius_metres || 50000,
        exclude_user_id: currentUserId,
        filter_native: query.native_language || null,
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
          return this.getMockDiscoveryData(query, blockedIds);
        }
        // Filter fallback results for blocked users
        let fallbackResults = fallbackRes.data as UserProfile[];
        if (blockedIds.length > 0) {
          fallbackResults = fallbackResults.filter(
            (u) => !blockedIds.includes(u.id),
          );
        }
        return fallbackResults;
      }
      // Filter RPC results for blocked users
      let rpcResults = response.data as UserProfile[];
      if (blockedIds.length > 0) {
        rpcResults = rpcResults.filter((u) => !blockedIds.includes(u.id));
      }
      return rpcResults;
    }

    const response = await queryBuilder.limit(50);
    if (response.error || !response.data || response.data.length === 0) {
      return this.getMockDiscoveryData(query, blockedIds);
    }
    // Filter results for blocked users
    let results = response.data as UserProfile[];
    if (blockedIds.length > 0) {
      results = results.filter((u) => !blockedIds.includes(u.id));
    }
    return results;
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

    if (query.native_language) {
      filtered = filtered.filter(
        (u) => u.native_language === query.native_language,
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

    // Limit to 50
    return filtered.slice(0, 50) as UserProfile[];
  }
}
