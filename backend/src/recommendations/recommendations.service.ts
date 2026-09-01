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
const GDPR_MATCHMAKING_FILTERS = {
  is_deleted: false,
  privacy_hide_from_search: false,
  is_deletion_pending: false,
};
const CRON_USERS_LIMIT = 5000;
const REDIS_PIPELINE_BATCH = 200;

interface UserRow {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  native_languages?: string[] | null;
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
    this.logger.info('Starting daily recommendation calculations...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    let pipeline = redis.pipeline();
    let pipelineOps = 0;
    let totalCached = 0;

    const flushPipeline = async (): Promise<void> => {
      if (pipelineOps > 0) {
        const pendingPipeline = pipeline;
        pipeline = redis.pipeline();
        pipelineOps = 0;

        const results = await pendingPipeline.exec();
        const failedCommand = results?.find(([commandError]) => commandError);
        if (failedCommand?.[0]) {
          throw failedCommand[0];
        }
      }
    };

    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_languages, target_languages')
        .match(GDPR_MATCHMAKING_FILTERS)
        .is('scheduled_for_deletion_at', null)
        .not('target_languages', 'is', null)
        .limit(CRON_USERS_LIMIT);

      if (error || !users) {
        throw new Error(`Failed to fetch users: ${error?.message}`);
      }

      this.logger.info(
        `Computing recommendations for ${users.length} users...`,
      );

      // Collect unique language pairs to batch query, avoiding N+1 queries
      const pairSet = new Set<string>();
      const pairIndex = new Map<
        string,
        Array<{ userId: string; nativeLang: string; targetLang: string }>
      >();

      for (const user of users) {
        const nativeLangs = user['native_languages'] as string[] | null;
        const targetLangs = user['target_languages'] as string[] | null;
        if (!nativeLangs?.length || !targetLangs?.length) continue;

        const native = nativeLangs[0];
        const target = targetLangs[0];
        const key = `${target}:${native}`;
        pairSet.add(key);
        const bucket = pairIndex.get(key) ?? [];
        bucket.push({
          userId: user.id,
          nativeLang: native,
          targetLang: target,
        });
        pairIndex.set(key, bucket);
      }

      // Batch-fetch matches for each unique language pair
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
            .select(
              'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio',
            )
            .match(GDPR_MATCHMAKING_FILTERS)
            .is('scheduled_for_deletion_at', null)
            .overlaps('native_languages', [targetCode])
            .overlaps('target_languages', [nativeCode])
            .order('is_serious_learner', { ascending: false })
            .limit(DAILY_LIMIT);
        });

        const results = await Promise.all(queries);

        for (let i = 0; i < batchPairs.length; i++) {
          const pairKey = batchPairs[i];
          const matchesData = results[i];
          if (matchesData.error) {
            throw new Error('Failed to fetch daily recommendation matches');
          }
          const matchRows = matchesData.data as UserRow[] | null;

          if (!matchRows || matchRows.length === 0) {
            continue;
          }

          const userEntries = pairIndex.get(pairKey) ?? [];

          // O(1) matching & pre-serialization string manipulation optimization
          // 1. Map rows to DTOs once per batch, instead of once per user
          const dtos = matchRows.map((m) => ({
            id: m.id,
            displayName: m.display_name ?? null,
            avatarUrl: m.avatar_url ?? null,
            nativeLanguage: m.native_languages?.[0] ?? null,
            targetLanguages: m.target_languages ?? null,
            sharedInterests: 0,
            isSeriousLearner: m.is_serious_learner ?? null,
            studyStreakDays: m.study_streak_days ?? null,
            correctionRatio: m.correction_ratio ?? null,
          }));

          // 2. Pre-serialize to individual JSON strings and build full array string
          const jsonParts = dtos.map((dto) => JSON.stringify(dto));
          const fullJsonStr = `[${jsonParts.join(',')}]`;

          // 3. Pre-compute O(1) lookup table for matches
          const matchIndices = new Map<string, number>();
          for (let k = 0; k < dtos.length; k++) {
            matchIndices.set(dtos[k].id, k);
          }

          for (const entry of userEntries) {
            const matchIndex = matchIndices.get(entry.userId);
            let jsonToCache: string | null = null;

            if (matchIndex === undefined) {
              if (jsonParts.length > 0) {
                jsonToCache = fullJsonStr;
              }
            } else {
              if (jsonParts.length > 1) {
                const strToRemove = jsonParts[matchIndex];
                if (matchIndex === 0) {
                  jsonToCache = fullJsonStr.replace(`${strToRemove},`, '');
                } else if (matchIndex === jsonParts.length - 1) {
                  jsonToCache = fullJsonStr.replace(`,${strToRemove}`, '');
                } else {
                  jsonToCache = fullJsonStr.replace(`,${strToRemove},`, ',');
                }
              }
            }

            if (jsonToCache !== null) {
              pipeline.set(
                `recommendations:daily:${entry.userId}`,
                jsonToCache,
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
        }
      }

      await flushPipeline();
      this.logger.info(
        `Successfully calculated and cached ${totalCached} daily recommendation sets.`,
      );
    } catch (error) {
      await flushPipeline();
      this.logger.error('Error calculating daily recommendations', error);
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
          const seenIds = new Set<string>();
          const recommendations = parsed
            .filter(
              (candidate): candidate is RecommendedUserDto =>
                isRecord(candidate) &&
                typeof candidate['id'] === 'string' &&
                candidate['id'].length > 0,
            )
            .filter((candidate) => {
              if (seenIds.has(candidate.id)) return false;
              seenIds.add(candidate.id);
              return true;
            })
            .slice(0, DAILY_LIMIT);

          if (recommendations.length > 0) {
            const supabase = this.supabaseService.getClient();
            const ids = recommendations.map((candidate) => candidate.id);
            const { data: discoverableUsers, error } = await supabase
              .from('users')
              .select('id')
              .in('id', ids)
              .match(GDPR_MATCHMAKING_FILTERS)
              .is('scheduled_for_deletion_at', null)
              .limit(ids.length);

            if (error || !Array.isArray(discoverableUsers)) {
              throw new Error(
                `Failed to revalidate cached recommendations: ${error?.message ?? 'invalid response'}`,
              );
            }

            const discoverableIds = new Set(
              discoverableUsers
                .filter(
                  (candidate): candidate is { id: string } =>
                    isRecord(candidate) && typeof candidate['id'] === 'string',
                )
                .map((candidate) => candidate.id),
            );
            const safeRecommendations = recommendations.filter((candidate) =>
              discoverableIds.has(candidate.id),
            );

            if (safeRecommendations.length > 0) {
              return safeRecommendations;
            }
          }
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
      const circuitOpen =
        !this.circuitBreakerService.isAvailable('matchmaking');

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
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .in('id', candidateIds)
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null);

    if (usersError) {
      throw new Error(usersError.message);
    }

    return (users ?? [])
      .map((u) => ({
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        nativeLanguage: u.native_languages?.[0] ?? null,
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
        .select('native_languages, target_languages')
        .eq('id', userId)
        .maybeSingle(),
    );

    if (userError || !user) {
      throw new Error(
        `Failed to fetch user profile: ${userError?.message ?? 'not found'}`,
      );
    }

    const nativeLangs = user['native_languages'] as string[] | null;
    const targetLanguages = user['target_languages'] as string[] | null;

    if (!nativeLangs?.length || !targetLanguages?.length) {
      return [];
    }

    const { data: matches, error: matchError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .neq('id', userId)
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null)
      .overlaps('native_languages', targetLanguages)
      .overlaps('target_languages', nativeLangs)
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
      nativeLanguage: m.native_languages?.[0] ?? null,
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
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .neq('id', userId)
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null)
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
      nativeLanguage: u.native_languages?.[0] ?? null,
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
