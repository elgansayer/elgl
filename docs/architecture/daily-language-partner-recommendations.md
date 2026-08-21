# Daily language-partner recommendations

Issue #456 is implemented by `backend/src/recommendations/recommendations.service.ts` and wired through `RecommendationsModule`.

## Runtime contract

`RecommendationsService.calculateDailyRecommendations()` is a NestJS scheduled job using `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`. The application-level `ScheduleModule.forRoot()` registration activates the decorator at runtime.

The job:

- selects eligible, non-deleted users with target-language data;
- groups users by reciprocal native/target language pairs to avoid an N+1 query per user;
- fetches candidate partners in bounded batches;
- excludes the current user from their own recommendation list;
- limits the cached result to at most 10 partners;
- caches complete recommendation DTOs in Redis under `recommendations:daily:<userId>`;
- gives each cache entry a 24-hour TTL;
- batches Redis writes through a pipeline;
- logs successful completion and reports degraded execution through matchmaking crash reporting when the scheduled calculation fails.

`getDailyRecommendations()` reads the cache first and falls back to live language-exchange matching if Redis is unavailable or the cache is missing.

## Dependency wiring

The scheduled job depends on Supabase for candidate data, Redis through `SupabaseService`, metrics, structured logging, the matchmaking circuit breaker, and crash reporting. `RecommendationsModule` declares the Supabase and metrics modules explicitly even though they are application-global. This keeps the feature module self-describing and prevents scheduled-job dependency wiring from relying on incidental root-module import order.

## Privacy and safety boundaries

The cron query uses the repository's GDPR matchmaking filters and does not intentionally cache credentials, message contents, or other private payloads. Cached recommendation records contain only the fields required by the recommendation response DTO.

Any future expansion of the cached DTO must review data minimisation and deletion behavior before deployment.

## Verification

Relevant automated coverage lives in:

- `backend/src/recommendations/recommendations.service.spec.ts` for daily calculation, cache population, error handling, and read fallback behavior;
- `backend/src/recommendations/recommendations.module.spec.ts` for controller/provider/export registration and scheduled-job data/metrics dependency wiring.

Backend CI should run the normal Vitest, lint, and Nest build gates before merge.

## Rollback

The dependency-wiring change is configuration-only at the Nest module level. Reverting the module import and its matching metadata assertion restores the previous behavior. The cron implementation and Redis cache format are unchanged by the completion change for issue #456.
