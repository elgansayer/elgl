import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { MatchmakingErrorBoundaryService } from '../matchmaking/matchmaking-error-boundary.service';
import { MOCK_USERS } from '../mock-data';

export interface RecommendedUserDto {
  id: string;
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
  nativeLanguage: string | null | undefined;
  targetLanguages: string[] | null | undefined;
  sharedInterests: number;
  isSeriousLearner: boolean | null | undefined;
  studyStreakDays: number | null | undefined;
  correctionRatio: number | null | undefined;
  /** Indicates which fallback tier produced this recommendation. */
  matchTier?: 'interest' | 'language_exchange' | 'active_users' | 'mock';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const DAILY_REDIS_TTL = 86400; // 24 hours
const DAILY_LIMIT = 10;
const FALLBACK_LIMIT = 20;

const SERVICE_NAME = 'recommendations';

interface UserRow {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  native_language?: string | null;
  target_languages?: string[] | null;
  is_serious_learner?: boolean | null;
  study_streak_days?: number | null;
  correction_ratio?: number | null;
  privacy_hide_from_search?: boolean | null;
  last_active_at?: string | null;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly errorBoundary: MatchmakingErrorBoundaryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations(): Promise<void> {
    this.logger.log('Starting daily recommendation calculations...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_language, target_languages')
        .eq('privacy_hide_from_search', false);

      if (error || !users) {
        throw new Error(`Failed to fetch users: ${error?.message}`);
      }

      for (const user of users) {
        const targetLanguages = user.target_languages as string[] | null;
        if (!targetLanguages || targetLanguages.length === 0) continue;

        const nativeLang = user.native_language as string | null;

        // Find language exchange partners: native in user's target AND learning user's native
        const { data: matches } = await supabase
          .from('users')
          .select(
            'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
          )
          .neq('id', user.id)
          .eq('privacy_hide_from_search', false)
          .in('native_language', targetLanguages)
          .contains('target_languages', nativeLang ? [nativeLang] : [])
          .order('is_serious_learner', { ascending: false })
          .limit(DAILY_LIMIT);

        if (matches && matches.length > 0) {
          const dtos: RecommendedUserDto[] = (matches as UserRow[]).map(
            (m) => ({
              id: m.id,
              displayName: m.display_name ?? null,
              avatarUrl: m.avatar_url ?? null,
              nativeLanguage: m.native_language ?? null,
              targetLanguages: m.target_languages ?? null,
              sharedInterests: 0,
              isSeriousLearner: m.is_serious_learner ?? null,
              studyStreakDays: m.study_streak_days ?? null,
              correctionRatio: m.correction_ratio ?? null,
            }),
          );

          // Cache the full top 10 recommendations in Redis for 24 hours
          await redis.set(
            `recommendations:daily:${user.id}`,
            JSON.stringify(dtos),
            'EX',
            DAILY_REDIS_TTL,
          );
        }
      }

      this.logger.log(
        'Successfully calculated and cached daily recommendations.',
      );
    } catch (error) {
      this.logger.error('Error calculating daily recommendations', error);
      await this.errorBoundary.captureError(error, {
        operation: 'calculateDailyRecommendations',
        service_name: SERVICE_NAME,
        params: {},
      });
    }
  }

  /** Returns cached top 10 language partner recommendations for a user.
   *  Gracefully degrades: Redis cache -> compute live -> empty array. */
  async getDailyRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(`recommendations:daily:${userId}`);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed as RecommendedUserDto[];
        }
      }
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for daily recommendations (user ${userId}), falling back to live computation`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getDailyRecommendations_redis',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'cache',
      });
      // Fall through to live computation
    }

    // Tier 2: compute language-exchange recommendations on the fly
    try {
      return await this.recommendationsByLanguageExchange(userId);
    } catch (error) {
      this.logger.warn(
        `Live language-exchange fallback failed for user ${userId}`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getDailyRecommendations_languageExchange',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'language_exchange',
      });
    }

    return [];
  }

  /** Interest-based recommendations. Falls back gracefully through tiers
   *  when any tier returns empty or throws. */
  async getRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    // Tier 1: Interest-based
    try {
      const interestResults = await this.recommendationsByInterests(userId);
      if (interestResults.length > 0) return interestResults;
    } catch (error) {
      this.logger.warn(
        `Interest-based recommendations failed for user ${userId}, falling back to language exchange`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendations_tier1_interest',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'interest',
      });
    }

    // Tier 2: language exchange matchmaking
    try {
      const languageMatches = await this.recommendationsByLanguageExchange(
        userId,
      );
      if (languageMatches.length > 0) return languageMatches;
    } catch (error) {
      this.logger.warn(
        `Language exchange fallback failed for user ${userId}`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendations_tier2_languageExchange',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'language_exchange',
      });
    }

    // Tier 3: most active users
    try {
      const activeUsers = await this.recommendationsByActiveUsers(userId);
      if (activeUsers.length > 0) return activeUsers;
    } catch (error) {
      this.logger.error(
        `Active users fallback failed for user ${userId}`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendations_tier3_activeUsers',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'active_users',
      });
    }

    // Tier 4: mock data as ultimate fallback
    return this.recommendationsFromMock(userId);
  }

  /** Orchestrates multi-tier recommendations with graceful degradation.
   *  Designed as the primary public API for matchmaking consumers. */
  async getRecommendationsWithFallback(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    // Tier 1: Interest-based (highest quality)
    try {
      const interestResults = await this.recommendationsByInterests(userId);
      if (interestResults.length > 0) {
        return interestResults.map((r) => ({
          ...r,
          matchTier: 'interest' as const,
        }));
      }
    } catch (error) {
      this.logger.warn(
        `Tier 1 (interest) unavailable for user ${userId}, degrading`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendationsWithFallback_tier1_interest',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'interest',
      });
    }

    // Tier 2: Language exchange
    try {
      const languageResults = await this.recommendationsByLanguageExchange(
        userId,
      );
      if (languageResults.length > 0) {
        return languageResults.map((r) => ({
          ...r,
          matchTier: 'language_exchange' as const,
        }));
      }
    } catch (error) {
      this.logger.warn(
        `Tier 2 (language exchange) unavailable for user ${userId}, degrading`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendationsWithFallback_tier2_languageExchange',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'language_exchange',
      });
    }

    // Tier 3: Most active users
    try {
      const activeResults = await this.recommendationsByActiveUsers(userId);
      if (activeResults.length > 0) {
        return activeResults.map((r) => ({
          ...r,
          matchTier: 'active_users' as const,
        }));
      }
    } catch (error) {
      this.logger.error(
        `Tier 3 (active users) unavailable for user ${userId}, degrading to mock data`,
        error,
      );
      await this.errorBoundary.captureError(error, {
        operation: 'getRecommendationsWithFallback_tier3_activeUsers',
        service_name: SERVICE_NAME,
        user_id: userId,
        tier: 'active_users',
      });
    }

    // Tier 4: Mock data (always available)
    return this.recommendationsFromMock(userId);
  }

  // ---- Private fallback tier methods ----

  /** Tier 1: Interest-based matching via shared user_interests tags. */
  private async recommendationsByInterests(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: ownTags, error: tagsError } = await supabase
      .from('user_interests')
      .select('tag')
      .eq('user_id', userId);

    if (tagsError) {
      throw new Error(tagsError.message);
    }

    const tags: string[] = [];
    if (Array.isArray(ownTags)) {
      for (const row of ownTags) {
        if (isRecord(row)) {
          const value = row['tag'];
          if (typeof value === 'string') tags.push(value);
        }
      }
    }
    if (tags.length === 0) {
      return [];
    }

    const { data: shared, error: sharedError } = await supabase
      .from('user_interests')
      .select('user_id, tag')
      .in('tag', tags)
      .neq('user_id', userId);

    if (sharedError) {
      throw new Error(sharedError.message);
    }

    const sharedCount = new Map<string, number>();
    if (Array.isArray(shared)) {
      for (const row of shared) {
        if (isRecord(row)) {
          const uid = row['user_id'];
          if (typeof uid === 'string') {
            sharedCount.set(uid, (sharedCount.get(uid) ?? 0) + 1);
          }
        }
      }
    }

    if (sharedCount.size === 0) {
      return [];
    }

    const candidateIds = Array.from(sharedCount.keys());

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .in('id', candidateIds)
      .eq('privacy_hide_from_search', false);

    if (usersError) {
      throw new Error(usersError.message);
    }

    return (users ?? [])
      .map((u) => ({
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        nativeLanguage: u.native_language,
        targetLanguages: u.target_languages,
        sharedInterests: sharedCount.get(u.id) ?? 0,
        isSeriousLearner: u.is_serious_learner,
        studyStreakDays: u.study_streak_days,
        correctionRatio: u.correction_ratio,
      }))
      .sort((a, b) => {
        if (b.sharedInterests !== a.sharedInterests) {
          return b.sharedInterests - a.sharedInterests;
        }
        if (a.isSeriousLearner !== b.isSeriousLearner) {
          return b.isSeriousLearner ? 1 : -1;
        }
        return (b.studyStreakDays ?? 0) - (a.studyStreakDays ?? 0);
      })
      .slice(0, FALLBACK_LIMIT);
  }

  /** Tier 2: Language-exchange matching (complementary native/target languages). */
  private async recommendationsByLanguageExchange(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('native_language, target_languages')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !user) {
      throw new Error(
        `Failed to fetch user profile: ${userError?.message ?? 'not found'}`,
      );
    }

    const nativeLang = user['native_language'] as string | null;
    const targetLanguages = user['target_languages'] as string[] | null;

    if (
      !nativeLang ||
      !targetLanguages ||
      targetLanguages.length === 0
    ) {
      return [];
    }

    const { data: matches, error: matchError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .neq('id', userId)
      .eq('privacy_hide_from_search', false)
      .in('native_language', targetLanguages)
      .contains('target_languages', [nativeLang])
      .order('is_serious_learner', { ascending: false })
      .limit(FALLBACK_LIMIT);

    if (matchError) {
      throw new Error(matchError.message);
    }

    if (!matches || matches.length === 0) {
      return [];
    }

    return (matches as UserRow[]).map((m) => ({
      id: m.id,
      displayName: m.display_name ?? null,
      avatarUrl: m.avatar_url ?? null,
      nativeLanguage: m.native_language ?? null,
      targetLanguages: m.target_languages ?? null,
      sharedInterests: 0,
      isSeriousLearner: m.is_serious_learner ?? null,
      studyStreakDays: m.study_streak_days ?? null,
      correctionRatio: m.correction_ratio ?? null,
    }));
  }

  /** Tier 3: Most active users by recent activity and study streaks. */
  private async recommendationsByActiveUsers(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: users, error } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .neq('id', userId)
      .eq('privacy_hide_from_search', false)
      .order('study_streak_days', { ascending: false })
      .limit(FALLBACK_LIMIT);

    if (error) {
      throw new Error(error.message);
    }

    if (!users || users.length === 0) {
      return [];
    }

    return (users as UserRow[]).map((u) => ({
      id: u.id,
      displayName: u.display_name ?? null,
      avatarUrl: u.avatar_url ?? null,
      nativeLanguage: u.native_language ?? null,
      targetLanguages: u.target_languages ?? null,
      sharedInterests: 0,
      isSeriousLearner: u.is_serious_learner ?? null,
      studyStreakDays: u.study_streak_days ?? null,
      correctionRatio: u.correction_ratio ?? null,
    }));
  }

  /** Tier 4: Ultimate fallback using in-memory mock data. */
  private recommendationsFromMock(
    userId: string,
  ): RecommendedUserDto[] {
    this.logger.log(
      `Using mock data as ultimate fallback for user ${userId}`,
    );

    const mockUsers = MOCK_USERS as Array<{
      id: string;
      display_name: string;
      native_languages: string;
      target_languages: string[];
      study_streak_days: number;
      correction_ratio: number;
      is_serious_learner: boolean;
      avatar_url: string;
    }>;

    return mockUsers
      .filter((u) => u.id !== userId)
      .slice(0, FALLBACK_LIMIT)
      .map((u) => ({
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        nativeLanguage: u.native_languages,
        targetLanguages: u.target_languages,
        sharedInterests: 0,
        isSeriousLearner: u.is_serious_learner,
        studyStreakDays: u.study_streak_days,
        correctionRatio: u.correction_ratio,
        matchTier: 'mock' as const,
      }));
  }
}
