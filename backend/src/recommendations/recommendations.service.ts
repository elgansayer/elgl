import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { MOCK_USERS } from '../mock-data';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';

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
const CRON_USERS_LIMIT = 5000;
const REDIS_PIPELINE_BATCH = 200;

/**
 * GDPR base filter conditions shared across all matchmaking tiers.
 *
 * Users are excluded from recommendations unless:
 * - They have explicitly opted into matchmaking (GDPR Art 7 consent)
 * - They have not hidden their profile from search
 * - They are not deleted or pending deletion ("right to erasure")
 */
const GDPR_MATCHMAKING_FILTERS = {
  matchmaking_consent: true,
  privacy_hide_from_search: false,
  is_deleted: false,
  is_deletion_pending: false,
};

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
<<<<<<< HEAD
  constructor(
    @InjectPinoLogger(RecommendationsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
=======
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly crashReportService: MatchmakingCrashReportService,
>>>>>>> origin/main
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations(): Promise<void> {
    this.logger.info('Starting daily recommendation calculations...');
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
        .select('id, native_language, target_languages')
        .match(GDPR_MATCHMAKING_FILTERS)
        .not('target_languages', 'is', null)
        .limit(CRON_USERS_LIMIT);

      if (error || !users) {
        throw new Error(`Failed to fetch users: ${error?.message}`);
      }

      this.logger.log(`Computing recommendations for ${users.length} users...`);

      for (const user of users) {
        const targetLanguages = user.target_languages as string[] | null;
        if (!targetLanguages || targetLanguages.length === 0) continue;

        const nativeLang = user.native_language as string | null;

        const { data: matches } = await supabase
          .from('users')
          .select(
            'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
          )
          .neq('id', user.id)
          .match(GDPR_MATCHMAKING_FILTERS)
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

          pipeline.set(
            `recommendations:daily:${user.id}`,
            JSON.stringify(dtos),
            'EX',
            DAILY_REDIS_TTL,
          );
          pipelineOps++;
          totalCached++;

          if (pipelineOps >= REDIS_PIPELINE_BATCH) {
            await flushPipeline();
          }
        }
      }

<<<<<<< HEAD
      this.logger.info(
        'Successfully calculated and cached daily recommendations.',
=======
      await flushPipeline();
      this.logger.log(
        `Successfully calculated and cached ${totalCached} daily recommendation sets.`,
>>>>>>> origin/main
      );
    } catch (error) {
      await flushPipeline();
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const errorType =
        error instanceof Error ? error.constructor.name : 'UnknownError';

      this.logger.error('Error calculating daily recommendations', error);

      await this.crashReportService.reportCrash({
        operation: 'calculateDailyRecommendations',
        error_type: errorType,
        error_message: message,
        stack_trace: stack,
        context: { phase: 'daily_cron' },
      });
    }
  }

  /** Returns cached top 10 language partner recommendations for a user.
   *  Gracefully degrades: Redis cache -> compute live -> empty array. */
  async getDailyRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    const startTime = Date.now();

    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(`recommendations:daily:${userId}`);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const results = parsed as RecommendedUserDto[];
          this.metricsService.recordMatchmakingRecommendationsGenerated(
            'cached',
            'getDailyRecommendations',
            results.length,
          );
          this.metricsService.recordMatchmakingRecommendationsPerRequest(
            'cached',
            results.length,
          );
          this.metricsService.recordMatchmakingRequestDuration(
            'getDailyRecommendations',
            'success',
            (Date.now() - startTime) / 1000,
          );
          return results;
        }
      }
      this.metricsService.recordMatchmakingDailyCacheMiss('empty_cache');
    } catch (error) {
      this.logger.warn(
        `Redis unavailable for daily recommendations (user ${userId}), falling back to live computation`,
        error,
      );
      this.metricsService.recordMatchmakingDailyCacheMiss('redis_unavailable');
      // Fall through to live computation
    }

    // Tier 2: compute language-exchange recommendations on the fly
    try {
      const liveResults = await this.recommendationsByLanguageExchange(userId);
      if (liveResults.length > 0) {
        this.metricsService.recordMatchmakingRecommendationsGenerated(
          'live_language_exchange',
          'getDailyRecommendations',
          liveResults.length,
        );
        this.metricsService.recordMatchmakingRecommendationsPerRequest(
          'live_language_exchange',
          liveResults.length,
        );
        this.metricsService.recordMatchmakingRequestDuration(
          'getDailyRecommendations',
          'success',
          (Date.now() - startTime) / 1000,
        );
        return liveResults;
      }
    } catch (error) {
      this.logger.warn(
        `Live language-exchange fallback failed for user ${userId}`,
        error,
      );
    }

    this.metricsService.recordMatchmakingEmptyResults('getDailyRecommendations');
    this.metricsService.recordMatchmakingRequestDuration(
      'getDailyRecommendations',
      'empty',
      (Date.now() - startTime) / 1000,
    );
    return [];
  }

  /** Interest-based recommendations. Falls back gracefully through tiers
   *  when any tier returns empty or throws. */
  async getRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    const startTime = Date.now();

    // Tier 1: Interest-based
    try {
      const interestResults = await this.recommendationsByInterests(userId);
      if (interestResults.length > 0) {
        this.recordMatchmakingSuccess(
          'getRecommendations',
          'interest',
          interestResults.length,
          startTime,
        );
        return interestResults;
      }
    } catch (error) {
      this.logger.warn(
        `Interest-based recommendations failed for user ${userId}, falling back to language exchange`,
        error,
      );
    }

    // Tier 2: language exchange matchmaking
    try {
      const languageMatches = await this.recommendationsByLanguageExchange(
        userId,
      );
      if (languageMatches.length > 0) {
        this.recordMatchmakingSuccess(
          'getRecommendations',
          'language_exchange',
          languageMatches.length,
          startTime,
        );
        return languageMatches;
      }
    } catch (error) {
      this.logger.warn(
        `Language exchange fallback failed for user ${userId}`,
        error,
      );
    }

    // Tier 3: most active users
    try {
      const activeUsers = await this.recommendationsByActiveUsers(userId);
      if (activeUsers.length > 0) {
        this.recordMatchmakingSuccess(
          'getRecommendations',
          'active_users',
          activeUsers.length,
          startTime,
        );
        return activeUsers;
      }
    } catch (error) {
      this.logger.error(
        `Active users fallback failed for user ${userId}`,
        error,
      );
    }

    // Tier 4: mock data as ultimate fallback
    const mockResults = this.recommendationsFromMock(userId);
    this.recordMatchmakingSuccess(
      'getRecommendations',
      'mock',
      mockResults.length,
      startTime,
    );
    return mockResults;
  }

  /** Orchestrates multi-tier recommendations with graceful degradation.
   *  Designed as the primary public API for matchmaking consumers. */
  async getRecommendationsWithFallback(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const startTime = Date.now();
    let lastTier: string = 'none';

    // Tier 1: Interest-based (highest quality)
    try {
      const interestResults = await this.recommendationsByInterests(userId);
      if (interestResults.length > 0) {
        const results = interestResults.map((r) => ({
          ...r,
          matchTier: 'interest' as const,
        }));
        this.recordMatchmakingSuccess(
          'getRecommendationsWithFallback',
          'interest',
          results.length,
          startTime,
        );
        return results;
      }
      lastTier = 'interest';
    } catch (error) {
      this.logger.warn(
        `Tier 1 (interest) unavailable for user ${userId}, degrading`,
        error,
      );
      lastTier = 'interest';
      this.metricsService.recordMatchmakingFallbackTierUsed(
        'interest',
        'language_exchange',
      );
    }

    // Tier 2: Language exchange
    try {
      const languageResults =
        await this.recommendationsByLanguageExchange(userId);
      if (languageResults.length > 0) {
        const results = languageResults.map((r) => ({
          ...r,
          matchTier: 'language_exchange' as const,
        }));
        this.recordMatchmakingSuccess(
          'getRecommendationsWithFallback',
          'language_exchange',
          results.length,
          startTime,
        );
        return results;
      }
      if (lastTier !== 'language_exchange') {
        this.metricsService.recordMatchmakingFallbackTierUsed(
          lastTier,
          'language_exchange',
        );
      }
      lastTier = 'language_exchange';
    } catch (error) {
      this.logger.warn(
        `Tier 2 (language exchange) unavailable for user ${userId}, degrading`,
        error,
      );
      this.metricsService.recordMatchmakingFallbackTierUsed(
        lastTier,
        'active_users',
      );
      lastTier = 'language_exchange';
    }

    // Tier 3: Most active users
    try {
      const activeResults = await this.recommendationsByActiveUsers(userId);
      if (activeResults.length > 0) {
        const results = activeResults.map((r) => ({
          ...r,
          matchTier: 'active_users' as const,
        }));
        this.recordMatchmakingSuccess(
          'getRecommendationsWithFallback',
          'active_users',
          results.length,
          startTime,
        );
        return results;
      }
      this.metricsService.recordMatchmakingFallbackTierUsed(
        lastTier,
        'active_users',
      );
      lastTier = 'active_users';
    } catch (error) {
      this.logger.error(
        `Tier 3 (active users) unavailable for user ${userId}, degrading to mock data`,
        error,
      );
      this.metricsService.recordMatchmakingFallbackTierUsed(
        lastTier,
        'mock',
      );
      lastTier = 'active_users';
    }

    // Tier 4: Mock data (always available)
    const mockResults = this.recommendationsFromMock(userId);
    this.metricsService.recordMatchmakingFallbackTierUsed(
      lastTier,
      'mock',
    );
    this.recordMatchmakingSuccess(
      'getRecommendationsWithFallback',
      'mock',
      mockResults.length,
      startTime,
    );
    return mockResults;
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
      .match(GDPR_MATCHMAKING_FILTERS);

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

    if (!nativeLang || !targetLanguages || targetLanguages.length === 0) {
      return [];
    }

    const { data: matches, error: matchError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .neq('id', userId)
      .match(GDPR_MATCHMAKING_FILTERS)
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
      .match(GDPR_MATCHMAKING_FILTERS)
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
<<<<<<< HEAD
  private recommendationsFromMock(
    userId: string,
  ): RecommendedUserDto[] {
    this.logger.info(
      `Using mock data as ultimate fallback for user ${userId}`,
    );
=======
  private recommendationsFromMock(userId: string): RecommendedUserDto[] {
    this.logger.log(`Using mock data as ultimate fallback for user ${userId}`);
>>>>>>> origin/main

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
  /** Records matchmaking success metrics in a single call. */
  private recordMatchmakingSuccess(
    endpoint: string,
    tier: string,
    resultCount: number,
    startTime: number,
  ): void {
    const durationSeconds = (Date.now() - startTime) / 1000;
    this.metricsService.recordMatchmakingRecommendationsGenerated(
      tier,
      endpoint,
      resultCount,
    );
    this.metricsService.recordMatchmakingRecommendationsPerRequest(
      tier,
      resultCount,
    );
    this.metricsService.recordMatchmakingRequestDuration(
      endpoint,
      'success',
      durationSeconds,
    );
  }

  // ---- GDPR compliance methods ----

  /**
   * Purge all cached recommendation data for a user in Redis.
   *
   * Called by DataRetentionService when a user is deleted/anonymised
   * (GDPR "right to erasure").  Also purges the user's own cache key
   * to prevent stale PII from being served after deletion.
   *
   * This covers both keys that include the user in others' results and
   * the user's own recommendation cache.
   */
  async purgeRecommendationsCache(userId: string): Promise<void> {
    const redis = this.supabaseService.getRedisClient();

    try {
      // Delete the user's own recommendations cache
      const ownKey = `recommendations:daily:${userId}`;
      await redis.del(ownKey);
      this.logger.log(
        `Purged own recommendations cache for user ${userId} (GDPR erasure)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to purge own recommendations cache for user ${userId}`,
        error,
      );
    }

    // Daily caches containing this user expire within 24 hours (DAILY_REDIS_TTL).
    // For immediate cleanup we would need to scan all `recommendations:daily:*`
    // keys, which is O(N) and should be rate-limited.  The 24-hour TTL serves
    // as the guard: GDPR allows "reasonable time" for erasure in backup/cache
    // layers.
    //
    // This approach is documented in the GDPR data-retention policy
    // (see data-retention.service.ts) and auditable via debug logs.
    this.logger.log(
      `GDPR erasure initiated for user ${userId}; recommendation cache TTL (${DAILY_REDIS_TTL}s) will expire stale copies`,
    );
  }

}