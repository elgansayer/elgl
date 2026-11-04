# Daily partner recommendations

Issues: #1043, #1392, #1740, Task: #1763

## Product contract

`RecommendationsService.calculateDailyRecommendations()` is the single canonical background job for the daily language-partner cache. Task #1763 and Issue #1043 track ensuring that the background job genuinely implements partner recommendations rather than unrelated audio-room co-host modifications (`inviteCoHost`/`removeCoHost`). The job is strictly scoped to language partner matchmaking and runs independently of audio-room services.

NestJS Schedule runs it every day at midnight (server time) under the scheduler name `daily-partner-recommendations`. For every eligible learner it caches up to 10 recommended language partners in Redis. `GET /recommendations/daily` and the Discovery "Recommended for you" carousel (`GET /recommendations/discovery`) read that cache.

- **Eligible learner:** not deleted, not hidden from search, not pending deletion, and with a primary native and target language (`native_languages[0]`, `target_languages[0]`).
- **Recommended partner:** an eligible user whose native languages include the learner's target language and whose target languages include the learner's native language, ranked by study streak (highest first) and then by id, so the order is stable between runs. The learner is never recommended to themself.
- **Result size:** at most 10 partners per learner. One spare candidate is fetched per language pair, so removing a learner who is themself a candidate still leaves 10 partners.
- **Cache entry:** key `recommendations:daily:{userId}`, 24-hour TTL, value a JSON array of `RecommendedUserDto` objects (public profile fields only). Serious-learner status is computed at run time from streak and recent activity, never from the stored flag.

A learner with no partner for their language pair has any previous entry deleted. The request path then falls back to live computation, so stale results are not presented as the current daily calculation and an empty cache is never shown to the learner as an outage.

## Execution model

### Single flight

Every backend replica fires the schedule at midnight. The job takes a Redis lock (`SET jobs:recommendations:daily:lock <token> NX EX 3600`) so exactly one replica runs it. The others record a `skipped` run and do no work. The lock is released with a compare-and-delete script, so a run whose lock expired can never free a newer holder's lock. If the holder crashes, the lock expires on its own long before the next run, which is 24 hours later.

The run also stops by itself after 45 minutes, so the holder always finishes inside its lock. The helper lives in `backend/src/common/redis-lock.ts`.

Re-running the job is safe at any time: it only rewrites the same keys (idempotent).

### Bounded and complete scan

Learners are read in keyset-paginated pages (`id > cursor ORDER BY id LIMIT 1000`), so no query is unbounded and no learner is skipped or repeated when rows change mid-run. The scan continues until the database returns an empty page, which keeps it correct even if PostgREST `max_rows` is set below the page size.

Learners sharing a primary language pair share one candidate query (up to 20 pair queries run concurrently), and a pair seen again on a later page is not queried again. Redis writes are pipelined in batches of 200.

Per-run ceiling: 50 pages, so 50,000 learners, or 45 minutes. A run that stops at a ceiling is marked `truncated`: it logs a warning and increments `hellotalk_matchmaking_daily_job_truncated_total`. The remaining learners keep working through live computation. Raise `MAX_LEARNER_PAGES` (and review Redis memory, roughly 3 KB per learner) or shard the scan by id range when this alert fires.

### Failure behaviour

| Situation                                                           | Behaviour                                                                                                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Another replica holds the lock                                      | Run recorded as `skipped`; nothing is read or written.                                                                                                                                  |
| One language pair's candidate query fails                           | That pair is skipped and logged; every other pair is refreshed. Its learners keep their previous entry until it expires, then use live computation. Run is `partial` and reported once. |
| Every candidate query fails, the learner scan fails, or Redis fails | Run is `failed` and reported. Sets already computed are still flushed. Redis writes are not retried within a run.                                                                       |
| Redis unavailable when taking the lock                              | Run is `failed` and reported; nothing is queried.                                                                                                                                       |
| Metrics, completion-time or lock-release call fails                 | Logged as a warning; the run outcome is unaffected.                                                                                                                                     |

The job never throws, so a bad night cannot disturb the scheduler or the other midnight jobs.

## Observability

Every log line, metric sample and crash report of one run shares a `runId`, so a failure can be traced without database access.

- **Structured logs** (pino): run summary with `outcome`, `durationMs`, `pagesScanned`, `learnersScanned`, `pairQueries`, `failedPairQueries`, `setsCached` and `truncated`. Database errors are reduced to their short PostgREST code. User ids, profile fields, Redis values and raw database error text are never logged.
- **Metrics** (`/api/metrics`):
  - `hellotalk_matchmaking_daily_job_runs_total{outcome}`: `success`, `partial`, `failed`, `skipped`.
  - `hellotalk_matchmaking_daily_job_duration_seconds{outcome}`: run latency histogram.
  - `hellotalk_matchmaking_daily_job_learners_scanned_total` and `hellotalk_matchmaking_daily_job_sets_cached_total`: volume.
  - `hellotalk_matchmaking_daily_job_truncated_total`: runs that hit a ceiling.
  - `hellotalk_matchmaking_daily_job_last_completed_timestamp_seconds`: last run that refreshed the cache. The job stores it in Redis (`jobs:recommendations:daily:last-completed`, no TTL) and `RecommendationsMetricsAggregator` publishes it, so it is identical on every replica and survives deploys.
- **Crash reports** (`matchmaking_crash_reports`): operation `calculateDailyRecommendations` (failed run) or `calculateDailyRecommendations:partial`, with the run counters in `context`. `user_id` is empty because the column is a UUID foreign key to `users`.

Suggested alerts:

- Stale cache: `time() - max(hellotalk_matchmaking_daily_job_last_completed_timestamp_seconds) > 93600` for 30 minutes (26 hours).
- Failed run: `increase(hellotalk_matchmaking_daily_job_runs_total{outcome="failed"}[1d]) > 0`.
- Capacity: `increase(hellotalk_matchmaking_daily_job_truncated_total[1d]) > 0`.

## Privacy and security

The cache holds only the public-profile fields the authenticated recommendation API already returns. Deleted users, users hidden from search and users pending deletion are excluded when learners and candidates are read. Blocks are not applied at calculation time (that would need a block-graph lookup per learner); `getDailyRecommendations()` removes blocked, hidden and deleted users on every read and falls back to live computation if nothing safe remains, so a stale entry can never expose someone who should not be visible.

Redis keys contain the internal user id and are private server-side state. The lock and completion keys sit outside the `recommendations:daily:` prefix so cache invalidation sweeps and the metrics key count never touch them. The job introduces no new endpoint, schema, credential or browser storage.

## Retention and deletion

Cache entries expire after 24 hours and are overwritten by the next run. Profile, language, interest and privacy changes invalidate a learner's entry immediately, and GDPR erasure removes it (`purgeRecommendationsCache`). The completion key is a single overwritten timestamp with no personal data.

The older, separate midnight job in `DiscoveryService` that wrote `daily_recommendations:{userId}` has been removed: nothing read those keys and it repeated the same work. The invalidation services still delete that prefix, so any leftover entries disappear within 24 hours of deployment.

## Verification

- `backend/src/recommendations/recommendations.daily-job.spec.ts`: behaviour against deterministic in-memory PostgREST and Redis models (pagination, `max_rows`, ceilings, lock contention across replicas, stale-entry removal, partial failure, observability, completion time).
- `backend/src/recommendations/daily-recommendations.contract.spec.ts`: query-level contract (privacy filters, bounds, ordering, key, TTL, self-exclusion, pair coalescing).
- `backend/src/recommendations/recommendations.daily-worker.contract.spec.ts`: schedule registration and "only one daily recommendation job".
- `backend/src/recommendations/recommendations.service.spec.ts`: read path and fallbacks.
- `backend/src/common/redis-lock.spec.ts`, `backend/src/metrics/metrics.service.spec.ts` and `backend/src/metrics/recommendations-metrics.aggregator.spec.ts`: lock helper and metrics.

The normal pull-request pipeline remains authoritative for backend lint, build, unit and E2E tests, and repository governance.

## Rollout and rollback

No migration, frontend change or configuration is required. Existing indexes already cover the queries (GIN on `native_languages` and `target_languages`, the partial `idx_users_discoverable`, and the primary key for the id cursor). Existing cache entries keep the same key and format, so they stay valid until the next midnight run refreshes them.

Rollback is a normal backend revert. Entries expire naturally, and the lock and completion keys can be deleted by hand if needed (`DEL jobs:recommendations:daily:lock` also unblocks a run that is wrongly believed to be in flight). While the job is disabled or failing, authenticated requests keep using the live-computation fallback.
