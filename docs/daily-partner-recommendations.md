# Daily partner recommendations

Issue: #1392

## Product contract

`RecommendationsService.calculateDailyRecommendations()` is the canonical background job for the daily language-partner cache. NestJS Schedule invokes it every day at midnight. The job reads eligible, non-deleted users, groups learners by their primary native/target language exchange pair, fetches candidate partners once per unique pair, removes the learner from their own result set, and caches up to 10 recommendations per learner in Redis.

The cache key is `recommendations:daily:{userId}` with a 24-hour TTL. `GET /recommendations/daily` remains authenticated and reads that cache through `getDailyRecommendations()`. If Redis is unavailable, the request path can fall back to the existing live language-exchange recommendation query rather than exposing a provider error as recommendation data.

The scheduled scan is deliberately bounded to 5,000 eligible users per run and candidate queries are coalesced by language pair to avoid an N+1 query per learner. Candidate queries are bounded to 10 rows and prefer serious learners using the existing recommendation ordering.

## Failure and observability

A top-level job failure is caught so one scheduler exception cannot crash the NestJS process. The service emits aggregate start/success/failure diagnostics and reports scheduler degradation through the existing matchmaking crash-report boundary. The scheduled path does not log recommendation payloads, profile text, credentials, access tokens, or Redis values.

The request path treats a malformed or unavailable cache as a cache miss and uses the established live fallback. A provider outage must never be represented as fabricated partner data.

## Privacy and security

The cache contains only the same public-profile recommendation fields already returned by the authenticated recommendation API. Deleted users are excluded by the existing GDPR matchmaking filter. The learner is removed from their own recommendation set before the cache is written.

Redis keys contain the internal user identifier because the value is private server-side infrastructure state; keys and values are never returned to the browser. No new schema, browser storage, credential, or analytics surface is introduced by this job.

## Verification

Focused coverage lives in:

- `backend/src/recommendations/daily-recommendations.contract.spec.ts`
- `backend/src/recommendations/recommendations.service.spec.ts`

The contract suite locks the 5,000-user scan bound, 10-candidate limit, serious-learner ordering, 24-hour Redis TTL, self-exclusion, and language-pair query coalescing. Run the backend unit suite or target the contract spec with the repository's normal Vitest command.

The normal pull-request pipeline remains authoritative for backend lint, build, unit/E2E tests, dependency review, database checks, and repository governance.

## Rollout and rollback

No database migration or coordinated frontend deployment is required. The job is already registered through `RecommendationsService` in the existing NestJS recommendations module and uses the configured Supabase and Redis clients.

Rollback is a normal backend revert. Cached entries expire naturally after 24 hours, so no destructive Redis cleanup is required. If the scheduler is temporarily disabled, authenticated requests retain the existing live-computation fallback path.
