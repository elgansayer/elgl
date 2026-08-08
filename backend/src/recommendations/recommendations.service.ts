import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { withRetry } from '../common/retry';
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

const DAILY_REDIS_TTL = 86400;
const DAILY_LIMIT = 10;
const FALLBACK_LIMIT = 20;
const GDPR_MATCHMAKING_FILTERS = { is_deleted: false };
const CRON_USERS_LIMIT = 5000;
const REDIS_PIPELINE_BATCH = 200;

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
  constructor(
    @InjectPinoLogger(RecommendationsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly crashReportService: MatchmakingCrashReportService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations(): Promise<void> {
    this.logger.info('Starting daily partner recommendation calculations...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    const startTime = Date.now();
    let pipelineOps = 0;
    let totalCached = 0;
    let pipeline = redis.pipeline();

    const flushPipeline = async (): Promise<void> => {
      if (pipelineOps > 0) {
        await pipeline.exec();
        pipeline = redis.pipeline();
        pipelineOps = 0;
      }
    };

    try {
      // Phase 1: Fetch all eligible users with full profiles in a single bulk query.
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select(
          'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
        )
        .match(GDPR_MATCHMAKING_FILTERS)
        .not('target_languages', 'is', null)
        .limit(CRON_USERS_LIMIT);

      if (usersError || !allUsers) {
        throw new Error(`Failed to fetch users: ${usersError?.message}`);
      }

      const eligibleUsers = allUsers as UserRow[];
      this.logger.info(
        `Fetched ${eligibleUsers.length} eligible users for batch recommendation computation`,
      );

      // Phase 2: Fetch all user_interests in bulk for interest-based matching.
      const userIds = eligibleUsers.map((u) => u.id);
      let interestsByUser = new Map<string, string[]>();

      if (userIds.length > 0) {
        // Query in chunks to avoid query size limits on large user bases.
        const INTEREST_CHUNK_SIZE = 1000;
        for (let offset = 0; offset < userIds.length; offset += INTEREST_CHUNK_SIZE) {
          const chunk = userIds.slice(offset, offset + INTEREST_CHUNK_SIZE);
          const { data: interestRows, error: interestError } = await supabase
            .from('user_interests')
            .select('user_id, tag')
            .in('user_id', chunk);

          if (!interestError && Array.isArray(interestRows)) {
            for (const row of interestRows) {
              if (isRecord(row)) {
                const uid = row['user_id'];
                const tag = row['tag'];
                if (typeof uid === 'string' && typeof tag === 'string') {
                  const tags = interestsByUser.get(uid) ?? [];
                  tags.push(tag);
                  interestsByUser.set(uid, tags);
                }
              }
            }
          }
        }
      }

      // Phase 3: Build index by native_language for efficient lookups.
      const usersByNativeLang = new Map<string, UserRow[]>();
      for (const user of eligibleUsers) {
        if (!user.native_language) continue;
        const key = user.native_language.toLowerCase();
        const bucket = usersByNativeLang.get(key) ?? [];
        bucket.push(user);
        usersByNativeLang.set(key, bucket);
      }

      // Phase 4: For each user, compute multi-tier recommendations in-memory.
      let processedCount = 0;

      for (const user of eligibleUsers) {
        processedCount++;
        const targetLanguages = user.target_languages as string[] | null;
        if (!targetLanguages || targetLanguages.length === 0) continue;

        const userTags = interestsByUser.get(user.id) ?? [];
        const nativeLang = (user.native_language as string | null)?.toLowerCase();

        const candidates: RecommendedUserDto[] = [];
        const seen = new Set<string>();

        // Tier 1: Interest-based matching (in-memory).
        if (userTags.length > 0) {
          for (const [otherUserId, otherTags] of interestsByUser) {
            if (otherUserId === user.id) continue;
            if (seen.has(otherUserId)) continue;

            const sharedCount = userTags.filter((t) =>
              otherTags.includes(t),
            ).length;
            if (sharedCount > 0) {
              const otherUser = eligibleUsers.find((u) => u.id === otherUserId);
              if (otherUser) {
                seen.add(otherUserId);
                candidates.push({
                  id: otherUser.id,
                  displayName: otherUser.display_name ?? null,
                  avatarUrl: otherUser.avatar_url ?? null,
                  nativeLanguage: otherUser.native_language ?? null,
                  targetLanguages: otherUser.target_languages ?? null,
                  sharedInterests: sharedCount,
                  isSeriousLearner: otherUser.is_serious_learner ?? null,
                  studyStreakDays: otherUser.study_streak_days ?? null,
                  correctionRatio: otherUser.correction_ratio ?? null,
                  matchTier: 'interest',
                });
              }
            }
          }
        }

        // Tier 2: Language exchange matching (in-memory, complementary languages).
        if (nativeLang && targetLanguages.length > 0) {
          for (const targetLang of targetLanguages) {
            const targetLangKey = targetLang.toLowerCase();
            const speakers = usersByNativeLang.get(targetLangKey) ?? [];
            for (const speaker of speakers) {
              if (speaker.id === user.id) continue;
              if (seen.has(speaker.id)) continue;

              const speakerTargets = (speaker.target_languages as string[] | null) ?? [];
              const speakerTargetsLower = speakerTargets.map((t) =>
                t.toLowerCase(),
              );
              // The partner's target languages must include the user's native language.
              if (!speakerTargetsLower.includes(nativeLang)) continue;

              seen.add(speaker.id);
              candidates.push({
                id: speaker.id,
                displayName: speaker.display_name ?? null,
                avatarUrl: speaker.avatar_url ?? null,
                nativeLanguage: speaker.native_language ?? null,
                targetLanguages: speaker.target_languages ?? null,
                sharedInterests: 0,
                isSeriousLearner: speaker.is_serious_learner ?? null,
                studyStreakDays: speaker.study_streak_days ?? null,
                correctionRatio: speaker.correction_ratio ?? null,
                matchTier: 'language_exchange',
              });
            }
          }
        }

        // Phase 5: Sort and limit results, then cache.
        if (candidates.length > 0) {
          candidates.sort((a, b) => {
            // Interest tier first.
            const tierA = a.matchTier === 'interest' ? 0 : 1;
            const tierB = b.matchTier === 'interest' ? 0 : 1;
            if (tierA !== tierB) return tierA - tierB;

            // Within same tier: shared interests (desc), serious learner, streak.
            if (b.sharedInterests !== a.sharedInterests) {
              return b.sharedInterests - a.sharedInterests;
            }
            if (a.isSeriousLearner !== b.isSeriousLearner) {
              return b.isSeriousLearner ? -1 : 1;
            }
            return (b.studyStreakDays ?? 0) - (a.studyStreakDays ?? 0);
          });

          const topK = candidates.slice(0, DAILY_LIMIT);

          pipeline.set(
            `recommendations:daily:${user.id}`,
            JSON.stringify(topK),
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

      await flushPipeline();

      const elapsed = Date.now() - startTime;
      this.logger.info(
        `Daily partner recommendations computed: cached ${totalCached} sets for ${processedCount} users in ${elapsed}ms`,
      );
    } catch (error) {
      await flushPipeline();
      this.logger.error('Error calculating daily partner recommendations', error);
      void this.reportTierDegradation(
        'calculateDailyRecommendations',
        'system',
        error,
        'none',
      );
    }
  }

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
      );
      void this.reportTierDegradation(
        'getDailyRecommendations:redis',
        userId,
        error,
        'language_exchange_live',
      );
    }

    try {
      const liveResults = await this.recommendationsByLanguageExchange(userId);
      if (liveResults.length > 0) {
        return liveResults;
      }
    } catch (error) {
      this.logger.warn(
        `Live language-exchange fallback failed for user ${userId}`,
      );
      void this.reportTierDegradation(
        'getDailyRecommendations:live',
        userId,
        error,
        'empty',
      );
    }

    return [];
  }

  async getRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    try {
      const interestResults = await this.recommendationsByInterests(userId);
      if (interestResults.length > 0) {
        return interestResults;
      }
    } catch (error) {
      this.logger.warn(
        `Interest-based recommendations failed for user ${userId}, falling back to language exchange`,
      );
      void this.reportTierDegradation(
        'getRecommendations:interest',
        userId,
        error,
        'language_exchange',
      );
    }

    try {
      const languageMatches =
        await this.recommendationsByLanguageExchange(userId);
      if (languageMatches.length > 0) {
        return languageMatches;
      }
    } catch (error) {
      this.logger.warn(`Language exchange fallback failed for user ${userId}`);
      void this.reportTierDegradation(
        'getRecommendations:language_exchange',
        userId,
        error,
        'active_users',
      );
    }

    try {
      const activeUsers = await this.recommendationsByActiveUsers(userId);
      if (activeUsers.length > 0) {
        return activeUsers;
      }
    } catch (error) {
      this.logger.error(
        `Active users fallback failed for user ${userId}`,
        error,
      );
      void this.reportTierDegradation(
        'getRecommendations:active_users',
        userId,
        error,
        'mock',
      );
    }

    const mockResults = this.recommendationsFromMock(userId);
    return mockResults;
  }

  async getRecommendationsWithFallback(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
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
      );
      void this.reportTierDegradation(
        'getRecommendationsWithFallback:interest',
        userId,
        error,
        'language_exchange',
      );
    }

    try {
      const languageResults =
        await this.recommendationsByLanguageExchange(userId);
      if (languageResults.length > 0) {
        return languageResults.map((r) => ({
          ...r,
          matchTier: 'language_exchange' as const,
        }));
      }
    } catch (error) {
      this.logger.warn(
        `Tier 2 (language exchange) unavailable for user ${userId}, degrading`,
      );
      void this.reportTierDegradation(
        'getRecommendationsWithFallback:language_exchange',
        userId,
        error,
        'active_users',
      );
    }

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
      );
      void this.reportTierDegradation(
        'getRecommendationsWithFallback:active_users',
        userId,
        error,
        'mock',
      );
    }

    const mockResults = this.recommendationsFromMock(userId);
    return mockResults;
  }

  /** Reports a tier degradation event to the crash reporting service without blocking the response. */
  private async reportTierDegradation(
    operation: string,
    userId: string,
    error: unknown,
    degradedTier: string,
  ): Promise<void> {
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      const circuitOpen = !this.circuitBreakerService.isAvailable('matchmaking');

      await this.crashReportService.reportCrash({
        operation,
        user_id: userId,
        error_type: err.constructor.name,
        error_message: err.message,
        stack_trace: err.stack,
        degraded_tier: degradedTier,
        circuit_breaker_open: circuitOpen,
      });
    } catch {
      this.logger.warn(
        `Failed to persist tier degradation report for ${operation}`,
      );
    }
  }

  private async recommendationsByInterests(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: ownTags, error: tagsError } = await withRetry(() =>
      supabase.from('user_interests').select('tag').eq('user_id', userId),
    );

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

    const { data: shared, error: sharedError } = await withRetry(() =>
      supabase
        .from('user_interests')
        .select('user_id, tag')
        .in('tag', tags)
        .neq('user_id', userId),
    );

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

  private async recommendationsByLanguageExchange(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: userError } = await withRetry(() =>
      supabase
        .from('users')
        .select('native_language, target_languages')
        .eq('id', userId)
        .maybeSingle(),
    );

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
  private recommendationsFromMock(userId: string): RecommendedUserDto[] {
    this.logger.info(`Using mock data as ultimate fallback for user ${userId}`);

    const mockUsers = MOCK_USERS as unknown as Array<{
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
        nativeLanguage: u.native_languages[0],
        targetLanguages: u.target_languages,
        sharedInterests: 0,
        isSeriousLearner: u.is_serious_learner,
        studyStreakDays: u.study_streak_days,
        correctionRatio: u.correction_ratio,
        matchTier: 'mock' as const,
      }));
  }

  async purgeRecommendationsCache(userId: string): Promise<void> {
    const redis = this.supabaseService.getRedisClient();

    try {
      const ownKey = `recommendations:daily:${userId}`;
      await redis.del(ownKey);
      this.logger.info(
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
    this.logger.info(
      `GDPR erasure initiated for user ${userId}; recommendation cache TTL (${DAILY_REDIS_TTL}s) will expire stale copies`,
    );
  }
}
