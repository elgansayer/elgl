import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Cron, CronExpression } from '@nestjs/schedule';
import type Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import type { MatchmakingDailyJobOutcome } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../escrow/circuit-breaker.service';
import { MatchmakingCrashReportService } from './matchmaking-crash-report.service';
import { withRetry } from '../common/retry';
import { acquireRedisLock } from '../common/redis-lock';
import type { RedisLock } from '../common/redis-lock';
import {
  DAILY_RECOMMENDATIONS_LAST_COMPLETED_KEY,
  DAILY_RECOMMENDATIONS_LOCK_KEY,
} from './daily-recommendations.keys';
import { MOCK_USERS } from '../mock-data';
import { SafetyService } from '../safety/safety.service';
import { isActiveSeriousLearner } from '../discovery/serious-learner.policy';

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

function parseCachedRecommendation(value: unknown): RecommendedUserDto | null {
  if (!isRecord(value)) return null;

  const requiredFields = [
    'id',
    'displayName',
    'avatarUrl',
    'nativeLanguage',
    'targetLanguages',
    'sharedInterests',
    'isSeriousLearner',
    'studyStreakDays',
    'correctionRatio',
  ] as const;
  if (
    !requiredFields.every((field) =>
      Object.prototype.hasOwnProperty.call(value, field),
    )
  ) {
    return null;
  }

  const id = value['id'];
  const displayName = value['displayName'];
  const avatarUrl = value['avatarUrl'];
  const nativeLanguage = value['nativeLanguage'];
  const targetLanguages = value['targetLanguages'];
  const sharedInterests = value['sharedInterests'];
  const isSeriousLearner = value['isSeriousLearner'];
  const studyStreakDays = value['studyStreakDays'];
  const correctionRatio = value['correctionRatio'];
  const matchTier = value['matchTier'];

  if (
    typeof id !== 'string' ||
    id.length === 0 ||
    (displayName !== null && typeof displayName !== 'string') ||
    (avatarUrl !== null && typeof avatarUrl !== 'string') ||
    (nativeLanguage !== null && typeof nativeLanguage !== 'string') ||
    (targetLanguages !== null &&
      (!Array.isArray(targetLanguages) ||
        !targetLanguages.every((language) => typeof language === 'string'))) ||
    typeof sharedInterests !== 'number' ||
    !Number.isFinite(sharedInterests) ||
    (isSeriousLearner !== null && typeof isSeriousLearner !== 'boolean') ||
    (studyStreakDays !== null &&
      (typeof studyStreakDays !== 'number' ||
        !Number.isFinite(studyStreakDays))) ||
    (correctionRatio !== null &&
      (typeof correctionRatio !== 'number' ||
        !Number.isFinite(correctionRatio))) ||
    (matchTier !== undefined &&
      matchTier !== 'interest' &&
      matchTier !== 'language_exchange' &&
      matchTier !== 'active_users' &&
      matchTier !== 'mock')
  ) {
    return null;
  }

  return {
    id,
    displayName,
    avatarUrl,
    nativeLanguage,
    targetLanguages,
    sharedInterests,
    isSeriousLearner,
    studyStreakDays,
    correctionRatio,
    ...(matchTier === undefined ? {} : { matchTier }),
  };
}

const DAILY_REDIS_TTL = 86400;
const DAILY_LIMIT = 10;
/**
 * Candidates fetched per language pair: one spare, so removing the learner
 * from a pool that happens to contain them still leaves DAILY_LIMIT partners.
 */
const DAILY_CANDIDATE_POOL = DAILY_LIMIT + 1;
const FALLBACK_LIMIT = 20;
const GDPR_MATCHMAKING_FILTERS = {
  is_deleted: false,
  privacy_hide_from_search: false,
  is_deletion_pending: false,
};

/** Scheduler registry name, so the job is individually addressable. */
const DAILY_JOB_NAME = 'daily-partner-recommendations';
/** Longer than DAILY_JOB_MAX_RUNTIME_MS, far shorter than the 24 hour cadence. */
const DAILY_JOB_LOCK_TTL_SECONDS = 3600;
/** Hard stop so the holder always finishes before its lock can expire. */
const DAILY_JOB_MAX_RUNTIME_MS = 45 * 60 * 1000;
/** Keyset page size; a PostgREST `max_rows` below it only means more pages. */
const LEARNER_PAGE_SIZE = 1000;
/** Per-run ceiling: 50 pages of 1000 = 50,000 learners. */
const MAX_LEARNER_PAGES = 50;
/** Concurrent candidate queries; one query serves every learner in a pair. */
const PAIR_QUERY_BATCH = 20;
const REDIS_PIPELINE_BATCH = 200;
const MAX_LOGGED_PAIR_FAILURES = 10;

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

/** A learner reduced to the primary language exchange pair the job matches on. */
interface DailyLearner {
  id: string;
  nativeLanguage: string;
  targetLanguage: string;
}

interface LanguagePair {
  key: string;
  nativeLanguage: string;
  targetLanguage: string;
}

interface LearnerBucket {
  pair: LanguagePair;
  learnerIds: string[];
}

interface LearnerPage {
  /** Rows PostgREST returned, including rows without a usable language pair. */
  rowCount: number;
  /** Keyset cursor for the next page; null when the page was empty. */
  lastId: string | null;
  learners: DailyLearner[];
}

/** Ranked partners for one language pair, shared by every learner in it. */
interface PairPool {
  candidates: RecommendedUserDto[];
  candidateIds: ReadonlySet<string>;
  /** JSON of the first DAILY_LIMIT candidates, for learners outside the pool. */
  sharedPayload: string;
}

interface DailyRunStats {
  /** Correlates every log line, metric sample and crash report of one run. */
  runId: string;
  pagesScanned: number;
  learnersScanned: number;
  pairQueries: number;
  failedPairQueries: number;
  setsCached: number;
  /** True when the run stopped at the learner or runtime ceiling. */
  truncated: boolean;
}

function readStringArray(value: unknown): string[] | null {
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
    ? value
    : null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** PostgREST error codes are short identifiers; anything else may carry data. */
function safeErrorCode(error: unknown): string {
  if (!isRecord(error) || typeof error['code'] !== 'string') return 'unknown';
  return /^[a-z0-9_-]{1,32}$/i.exec(error['code'])?.[0] ?? 'unknown';
}

function parseDailyLearner(row: unknown): DailyLearner | null {
  if (!isRecord(row)) return null;
  const id = row['id'];
  const nativeLanguage = readStringArray(row['native_languages'])?.[0];
  const targetLanguage = readStringArray(row['target_languages'])?.[0];
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!nativeLanguage || !targetLanguage) return null;
  return { id, nativeLanguage, targetLanguage };
}

function parseDailyCandidate(
  row: unknown,
  now: Date,
): RecommendedUserDto | null {
  if (!isRecord(row)) return null;
  const id = row['id'];
  if (typeof id !== 'string' || id.length === 0) return null;

  const studyStreakDays = readNullableNumber(row['study_streak_days']);
  return {
    id,
    displayName: readNullableString(row['display_name']),
    avatarUrl: readNullableString(row['avatar_url']),
    nativeLanguage: readStringArray(row['native_languages'])?.[0] ?? null,
    targetLanguages: readStringArray(row['target_languages']),
    sharedInterests: 0,
    isSeriousLearner: isActiveSeriousLearner(
      {
        study_streak_days: studyStreakDays,
        last_active_at: readNullableString(row['last_active_at']),
      },
      now,
    ),
    studyStreakDays,
    correctionRatio: readNullableNumber(row['correction_ratio']),
  };
}

/** Groups learners by exchange pair so each pair costs one candidate query. */
function bucketLearnersByPair(
  learners: readonly DailyLearner[],
): Map<string, LearnerBucket> {
  const buckets = new Map<string, LearnerBucket>();
  for (const learner of learners) {
    const key = JSON.stringify([
      learner.targetLanguage,
      learner.nativeLanguage,
    ]);
    const bucket = buckets.get(key) ?? {
      pair: {
        key,
        nativeLanguage: learner.nativeLanguage,
        targetLanguage: learner.targetLanguage,
      },
      learnerIds: [],
    };
    bucket.learnerIds.push(learner.id);
    buckets.set(key, bucket);
  }
  return buckets;
}

function buildPairPool(candidates: RecommendedUserDto[]): PairPool | null {
  if (candidates.length === 0) return null;
  return {
    candidates,
    candidateIds: new Set(candidates.map((candidate) => candidate.id)),
    sharedPayload: JSON.stringify(candidates.slice(0, DAILY_LIMIT)),
  };
}

/**
 * The cached top-10 for one learner: the pair's ranked partners without the
 * learner themself. Returns null when nobody else qualifies.
 */
function dailyPayloadFor(pool: PairPool, learnerId: string): string | null {
  if (!pool.candidateIds.has(learnerId)) return pool.sharedPayload;
  const partners = pool.candidates
    .filter((candidate) => candidate.id !== learnerId)
    .slice(0, DAILY_LIMIT);
  return partners.length > 0 ? JSON.stringify(partners) : null;
}

@Injectable()
export class RecommendationsService {
  constructor(
    @InjectPinoLogger(RecommendationsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly metricsService: MetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly crashReportService: MatchmakingCrashReportService,
  ) {}

  /**
   * Nightly job: caches each eligible learner's top 10 language partners in
   * Redis (`recommendations:daily:<userId>`, 24 hour TTL).
   *
   * - Single-flight: every replica fires at midnight, so a Redis lock lets
   *   exactly one of them run; the others record a `skipped` run.
   * - Bounded and complete: learners are read in keyset-paginated pages, and
   *   one candidate query serves every learner sharing a language pair.
   * - Resilient: a failing pair query only costs that pair its refresh; a
   *   Redis or learner-scan failure fails the run. It never throws, so one
   *   bad night cannot take down the scheduler.
   * - Idempotent: re-running simply rewrites the same keys.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: DAILY_JOB_NAME })
  async calculateDailyRecommendations(): Promise<void> {
    const startedAt = Date.now();
    const stats: DailyRunStats = {
      runId: randomUUID(),
      pagesScanned: 0,
      learnersScanned: 0,
      pairQueries: 0,
      failedPairQueries: 0,
      setsCached: 0,
      truncated: false,
    };
    let outcome: MatchmakingDailyJobOutcome = 'failed';
    let lock: RedisLock | null = null;

    try {
      const redis = this.supabaseService.getRedisClient();
      lock = await acquireRedisLock(
        redis,
        DAILY_RECOMMENDATIONS_LOCK_KEY,
        DAILY_JOB_LOCK_TTL_SECONDS,
      );
      if (lock === null) {
        outcome = 'skipped';
        return;
      }

      this.logger.info(
        { runId: stats.runId },
        'Starting daily recommendation calculations',
      );
      await this.cacheDailyRecommendations(redis, stats, startedAt);

      if (
        stats.pairQueries > 0 &&
        stats.failedPairQueries === stats.pairQueries
      ) {
        throw new Error('Every language pair candidate query failed');
      }

      outcome = stats.failedPairQueries > 0 ? 'partial' : 'success';
      await this.recordDailyCompletion(redis, stats.runId);
      if (outcome === 'partial') {
        await this.reportTierDegradation(
          'calculateDailyRecommendations:partial',
          null,
          new Error(
            `${stats.failedPairQueries} of ${stats.pairQueries} language pair candidate queries failed`,
          ),
          'language_exchange_live',
          this.dailyRunContext(stats),
        );
      }
    } catch (error: unknown) {
      outcome = 'failed';
      this.logger.error(
        { runId: stats.runId, err: error },
        'Error calculating daily recommendations',
      );
      await this.reportTierDegradation(
        'calculateDailyRecommendations',
        null,
        error,
        'none',
        this.dailyRunContext(stats),
      );
    } finally {
      await this.releaseDailyLock(lock, stats.runId);
      this.finishDailyRun(outcome, stats, Date.now() - startedAt);
    }
  }

  /** Pages through eligible learners and writes each one's cached top 10. */
  private async cacheDailyRecommendations(
    redis: Redis,
    stats: DailyRunStats,
    startedAt: number,
  ): Promise<void> {
    const now = new Date();
    // One entry per language pair for the whole run, so pairs recurring on
    // later pages are not queried again. null means the query succeeded but
    // no partner currently qualifies.
    const pools = new Map<string, PairPool | null>();
    const failedPairKeys = new Set<string>();

    let pipeline = redis.pipeline();
    let pipelineOps = 0;
    let pendingSets = 0;

    const flushPipeline = async (): Promise<void> => {
      if (pipelineOps > 0) {
        const pendingPipeline = pipeline;
        const completedSets = pendingSets;
        pipeline = redis.pipeline();
        pipelineOps = 0;
        pendingSets = 0;

        const results = await pendingPipeline.exec();
        const failedCommand = results?.find(([commandError]) => commandError);
        if (failedCommand?.[0]) {
          throw failedCommand[0];
        }
        stats.setsCached += completedSets;
      }
    };

    try {
      let afterId: string | null = null;
      let exhausted = false;

      for (let index = 0; index < MAX_LEARNER_PAGES; index++) {
        if (Date.now() - startedAt >= DAILY_JOB_MAX_RUNTIME_MS) break;

        const page = await this.fetchLearnerPage(afterId);
        if (page.lastId === null) {
          exhausted = true;
          break;
        }
        afterId = page.lastId;
        stats.pagesScanned++;
        stats.learnersScanned += page.rowCount;

        const buckets = bucketLearnersByPair(page.learners);
        await this.loadPairPools(
          Array.from(buckets.values(), (bucket) => bucket.pair),
          pools,
          failedPairKeys,
          stats,
          now,
        );

        for (const bucket of buckets.values()) {
          if (failedPairKeys.has(bucket.pair.key)) continue;
          const pool = pools.get(bucket.pair.key);

          for (const learnerId of bucket.learnerIds) {
            const key = `recommendations:daily:${learnerId}`;
            const payload = pool ? dailyPayloadFor(pool, learnerId) : null;

            if (payload === null) {
              pipeline.del(key);
            } else {
              pipeline.set(key, payload, 'EX', DAILY_REDIS_TTL);
              pendingSets++;
            }
            pipelineOps++;
            if (pipelineOps >= REDIS_PIPELINE_BATCH) {
              await flushPipeline();
            }
          }
        }
      }

      stats.truncated = !exhausted;
      await flushPipeline();
    } catch (error: unknown) {
      // Keep the sets already computed for this page; the run still fails.
      await flushPipeline().catch(() => undefined);
      throw error;
    }
  }

  /** Reads the next page of eligible learners, ordered by id (keyset cursor). */
  private async fetchLearnerPage(afterId: string | null): Promise<LearnerPage> {
    let query = this.supabaseService
      .getClient()
      .from('users')
      .select('id, native_languages, target_languages')
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null)
      .not('target_languages', 'is', null);
    if (afterId !== null) {
      query = query.gt('id', afterId);
    }

    const { data, error } = await query
      .order('id', { ascending: true })
      .limit(LEARNER_PAGE_SIZE);

    if (error || !Array.isArray(data)) {
      throw new Error(`Failed to fetch learners (${safeErrorCode(error)})`);
    }

    const learners: DailyLearner[] = [];
    let lastId: string | null = null;
    for (const row of data) {
      const learner = parseDailyLearner(row);
      if (learner) learners.push(learner);
      const rowId: unknown = isRecord(row) ? row['id'] : undefined;
      if (typeof rowId === 'string' && rowId.length > 0) lastId = rowId;
    }
    if (data.length > 0 && lastId === null) {
      throw new Error('Failed to fetch learners (unusable page)');
    }

    return { rowCount: data.length, lastId, learners };
  }

  /** Queries candidates for pairs not seen yet, isolating per-pair failures. */
  private async loadPairPools(
    pairs: readonly LanguagePair[],
    pools: Map<string, PairPool | null>,
    failedPairKeys: Set<string>,
    stats: DailyRunStats,
    now: Date,
  ): Promise<void> {
    const unseen = pairs.filter((pair) => !pools.has(pair.key));

    for (let i = 0; i < unseen.length; i += PAIR_QUERY_BATCH) {
      const batch = unseen.slice(i, i + PAIR_QUERY_BATCH);
      stats.pairQueries += batch.length;

      const settled = await Promise.all(
        batch.map(async (pair) => {
          try {
            return { pair, pool: await this.fetchPairPool(pair, now) };
          } catch (error: unknown) {
            stats.failedPairQueries++;
            if (stats.failedPairQueries <= MAX_LOGGED_PAIR_FAILURES) {
              this.logger.warn(
                {
                  runId: stats.runId,
                  nativeLanguage: pair.nativeLanguage,
                  targetLanguage: pair.targetLanguage,
                  err: error,
                },
                'Daily recommendation candidate query failed; keeping the previous cache for this language pair',
              );
            }
            failedPairKeys.add(pair.key);
            return { pair, pool: null };
          }
        }),
      );

      for (const { pair, pool } of settled) {
        pools.set(pair.key, pool);
      }
    }
  }

  /**
   * The ranked partners for one pair: native speakers of the learner's target
   * language who are learning the learner's native language, strongest study
   * streak first (id breaks ties so the list is stable between runs).
   */
  private async fetchPairPool(
    pair: LanguagePair,
    now: Date,
  ): Promise<PairPool | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio, last_active_at',
      )
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null)
      .overlaps('native_languages', [pair.targetLanguage])
      .overlaps('target_languages', [pair.nativeLanguage])
      .order('study_streak_days', { ascending: false })
      .order('id', { ascending: true })
      .limit(DAILY_CANDIDATE_POOL);

    if (error || !Array.isArray(data)) {
      throw new Error(
        `Failed to fetch daily recommendation matches (${safeErrorCode(error)})`,
      );
    }

    const candidates: RecommendedUserDto[] = [];
    for (const row of data) {
      const candidate = parseDailyCandidate(row, now);
      if (candidate) candidates.push(candidate);
    }
    return buildPairPool(candidates);
  }

  private dailyRunContext(stats: DailyRunStats): Record<string, unknown> {
    return {
      runId: stats.runId,
      pagesScanned: stats.pagesScanned,
      learnersScanned: stats.learnersScanned,
      pairQueries: stats.pairQueries,
      failedPairQueries: stats.failedPairQueries,
      setsCached: stats.setsCached,
      truncated: stats.truncated,
    };
  }

  /** Persists when the cache was last refreshed, for staleness monitoring. */
  private async recordDailyCompletion(
    redis: Redis,
    runId: string,
  ): Promise<void> {
    try {
      await redis.set(
        DAILY_RECOMMENDATIONS_LAST_COMPLETED_KEY,
        String(Math.floor(Date.now() / 1000)),
      );
    } catch {
      this.logger.warn(
        { runId },
        'Could not record the daily recommendation completion time',
      );
    }
  }

  private async releaseDailyLock(
    lock: RedisLock | null,
    runId: string,
  ): Promise<void> {
    if (lock === null) return;
    try {
      if (!(await lock.release())) {
        this.logger.warn(
          { runId },
          'Daily recommendation lock expired before the run finished',
        );
      }
    } catch {
      this.logger.warn(
        { runId },
        'Could not release the daily recommendation lock; it will expire on its own',
      );
    }
  }

  /** Emits the run summary and metrics; observability must never fail the job. */
  private finishDailyRun(
    outcome: MatchmakingDailyJobOutcome,
    stats: DailyRunStats,
    durationMs: number,
  ): void {
    const summary = {
      ...this.dailyRunContext(stats),
      outcome,
      durationMs,
    };
    if (outcome === 'success' || outcome === 'skipped') {
      this.logger.info(
        summary,
        outcome === 'skipped'
          ? 'Daily recommendation calculation already running on another instance; skipped'
          : 'Daily recommendation calculation finished',
      );
    } else {
      this.logger.warn(summary, 'Daily recommendation calculation degraded');
    }
    if (stats.truncated) {
      this.logger.warn(
        {
          runId: stats.runId,
          maxLearners: MAX_LEARNER_PAGES * LEARNER_PAGE_SIZE,
          maxRuntimeMs: DAILY_JOB_MAX_RUNTIME_MS,
        },
        'Daily recommendation run stopped at its ceiling; remaining learners use live computation',
      );
    }

    try {
      this.metricsService.recordMatchmakingDailyJobRun({
        outcome,
        durationSeconds: durationMs / 1000,
        learnersScanned: stats.learnersScanned,
        setsCached: stats.setsCached,
        truncated: stats.truncated,
      });
    } catch {
      this.logger.warn(
        { runId: stats.runId },
        'Could not record daily recommendation job metrics',
      );
    }
  }

  async getDailyRecommendations(
    userId: string,
    verifiedBlockedIds?: ReadonlySet<string>,
  ): Promise<RecommendedUserDto[]> {
    const blockedIds =
      verifiedBlockedIds ??
      new Set(await this.safetyService.getBlockedAndBlockerIds(userId));

    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(`recommendations:daily:${userId}`);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const seenIds = new Set<string>();
          const recommendations = parsed
            .map(parseCachedRecommendation)
            .filter(
              (candidate): candidate is RecommendedUserDto =>
                candidate !== null,
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
              const errorCode =
                error?.code?.match(/^[a-z0-9_-]{1,32}$/i)?.[0] ?? 'unknown';
              throw new Error(
                `Failed to revalidate cached recommendations (${errorCode})`,
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

            const unblockedRecommendations = safeRecommendations.filter(
              (candidate) => !blockedIds.has(candidate.id),
            );
            if (unblockedRecommendations.length > 0) {
              return unblockedRecommendations;
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn(
        `Cached daily recommendations unavailable or unsafe (user ${userId}), falling back to live computation`,
      );
      void this.reportTierDegradation(
        'getDailyRecommendations:cache-revalidation',
        userId,
        error,
        'language_exchange_live',
      );
    }

    try {
      const liveResults = await this.recommendationsByLanguageExchange(userId);
      const unblockedResults = liveResults.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedResults.length > 0) {
        return unblockedResults;
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
    const blockedIds = new Set(
      await this.safetyService.getBlockedAndBlockerIds(userId),
    );

    try {
      const interestResults = await this.recommendationsByInterests(userId);
      const unblockedResults = interestResults.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedResults.length > 0) {
        return unblockedResults;
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
      const unblockedMatches = languageMatches.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedMatches.length > 0) {
        return unblockedMatches;
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
      const unblockedUsers = activeUsers.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedUsers.length > 0) {
        return unblockedUsers;
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
    return mockResults.filter((candidate) => !blockedIds.has(candidate.id));
  }

  async getRecommendationsWithFallback(
    userId: string,
  ): Promise<RecommendedUserDto[]> {
    const blockedIds = new Set(
      await this.safetyService.getBlockedAndBlockerIds(userId),
    );

    try {
      const interestResults = await this.recommendationsByInterests(userId);
      const unblockedResults = interestResults.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedResults.length > 0) {
        return unblockedResults.map((r) => ({
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
      const unblockedResults = languageResults.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedResults.length > 0) {
        return unblockedResults.map((r) => ({
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
      const unblockedResults = activeResults.filter(
        (candidate) => !blockedIds.has(candidate.id),
      );
      if (unblockedResults.length > 0) {
        return unblockedResults.map((r) => ({
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
    return mockResults.filter((candidate) => !blockedIds.has(candidate.id));
  }

  /** Reports a tier degradation event to the crash reporting service without blocking the response. */
  private async reportTierDegradation(
    operation: string,
    userId: string | null,
    error: unknown,
    degradedTier: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      const circuitOpen =
        !this.circuitBreakerService.isAvailable('matchmaking');

      await this.crashReportService.reportCrash({
        operation,
        // matchmaking_crash_reports.user_id is a UUID foreign key, so system
        // level failures (scheduled jobs) must leave it unset.
        user_id: userId ?? undefined,
        error_type: err.constructor.name,
        error_message: err.message,
        stack_trace: err.stack,
        context,
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
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio, last_active_at',
      )
      .in('id', candidateIds)
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null);

    if (usersError) {
      throw new Error(usersError.message);
    }

    return ((users ?? []) as UserRow[])
      .map((u) => ({
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        nativeLanguage: u.native_languages?.[0] ?? null,
        targetLanguages: u.target_languages,
        sharedInterests: sharedCount.get(u.id) ?? 0,
        isSeriousLearner: isActiveSeriousLearner(u),
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
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio, last_active_at',
      )
      .neq('id', userId)
      .match(GDPR_MATCHMAKING_FILTERS)
      .is('scheduled_for_deletion_at', null)
      .overlaps('native_languages', targetLanguages)
      .overlaps('target_languages', nativeLangs)
      .order('study_streak_days', { ascending: false })
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
      isSeriousLearner: isActiveSeriousLearner(m),
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
        'id, display_name, avatar_url, native_languages, target_languages, is_serious_learner, study_streak_days, correction_ratio, last_active_at',
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
      isSeriousLearner: isActiveSeriousLearner(u),
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
      last_active_at?: string | null;
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
        isSeriousLearner: isActiveSeriousLearner(u),
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
