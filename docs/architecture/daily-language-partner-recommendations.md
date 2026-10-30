# Daily language-partner recommendations

Issue #456 introduced the job in `backend/src/recommendations/recommendations.service.ts`, wired through `RecommendationsModule`. Issues #1392 and #1740 hardened it for production. The full product contract, execution model, failure behaviour, observability and rollout notes live in [`docs/daily-partner-recommendations.md`](../daily-partner-recommendations.md); this page records the architecture and dependency wiring.

## Runtime contract

`RecommendationsService.calculateDailyRecommendations()` is a NestJS scheduled job using `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'daily-partner-recommendations' })`. The application-level `ScheduleModule.forRoot()` registration activates the decorator at runtime. It is the only scheduled daily recommendation job.

The job:

- takes a Redis single-flight lock so only one replica runs it per night;
- reads eligible, non-deleted learners with target-language data in keyset-paginated pages, so every learner is covered up to a bounded per-run ceiling;
- groups learners by their primary native/target language pair, so each pair costs one candidate query instead of one per learner;
- fetches candidate partners in bounded concurrent batches and isolates a failing pair from the rest of the run;
- excludes the learner from their own list and still returns 10 partners;
- caches complete recommendation DTOs in Redis under `recommendations:daily:<userId>` with a 24-hour TTL, written through batched pipelines;
- records structured logs, run metrics and a Redis-backed completion time, and reports failed or partial runs through matchmaking crash reporting.

`getDailyRecommendations()` reads the cache first, revalidates every cached partner against current privacy, deletion and block state, and falls back to live language-exchange matching if Redis is unavailable, the entry is missing, or nothing safe remains.

## Dependency wiring

The scheduled job depends on Supabase for candidate data, Redis through `SupabaseService`, metrics, structured logging, the matchmaking circuit breaker, and crash reporting. `RecommendationsModule` declares the Supabase and metrics modules explicitly even though they are application-global. This keeps the feature module self-describing and prevents scheduled-job dependency wiring from relying on incidental root-module import order.

`RecommendationsMetricsAggregator` (in `MetricsModule`) mirrors the job's completion time from Redis into the `hellotalk_matchmaking_daily_job_last_completed_timestamp_seconds` gauge. Both classes share the Redis key names from `backend/src/recommendations/daily-recommendations.keys.ts`.

## Privacy and safety boundaries

The cron queries use the repository's GDPR matchmaking filters and do not intentionally cache credentials, message contents, or other private payloads. Cached recommendation records contain only the fields required by the recommendation response DTO. The lock and completion keys carry no personal data and sit outside the `recommendations:daily:` prefix, which the invalidation sweeps and the metrics key count operate on.

Any future expansion of the cached DTO must review data minimisation and deletion behaviour before deployment.

## Verification

Relevant automated coverage lives in:

- `backend/src/recommendations/recommendations.daily-job.spec.ts` for pagination, lock contention, failure isolation, observability and completion time;
- `backend/src/recommendations/daily-recommendations.contract.spec.ts` and `recommendations.daily-worker.contract.spec.ts` for the query and scheduling contract;
- `backend/src/recommendations/recommendations.service.spec.ts` for the read path, cache population and fallbacks;
- `backend/src/recommendations/recommendations.module.spec.ts` for controller/provider/export registration and scheduled-job data/metrics dependency wiring;
- `backend/src/common/redis-lock.spec.ts` for the single-flight lock.

Backend CI should run the normal Vitest, lint, and Nest build gates before merge.

## Rollback

Reverting the change restores the previous job. Cache keys and the cached DTO format are unchanged, so no Redis cleanup is required; the lock expires on its own and the completion key can be deleted by hand.
