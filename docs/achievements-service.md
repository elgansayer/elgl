# Achievements service

The NestJS `AchievementsService` owns the server-authoritative milestone catalogue and awards earned badges. The catalogue currently contains message milestones at 1, 100 and 500 sent messages plus study-streak milestones at 7 and 30 days.

## Evaluation flow

Achievement definitions are idempotently seeded on backend startup by achievement `code`. Message delivery emits `message.sent`, while `StudyStreakService` emits `achievements.evaluate` after a successfully persisted streak update. Both events evaluate the latest persisted progress rather than trusting client-provided counters.

For each evaluation the service loads already-earned achievements, skips source queries for a milestone family that is fully complete, reads the remaining message/streak progress once, and attempts only newly due awards. `user_achievements` has a unique `(user_id, achievement_id)` constraint and the service uses an upsert on that pair, so repeated events, retries and concurrent evaluators cannot create duplicate awards.

The same in-code milestone catalogue supplies seed metadata, source ownership and progress thresholds. This prevents the displayed `required` value from drifting away from the value used to award a badge.

## API and authorization

All achievement routes remain behind `SupabaseAuthGuard`.

- `GET /achievements` returns the achievement definitions.
- `GET /achievements/user/:userId` returns earned badge definitions and is suitable for authenticated member-profile presentation. It intentionally does not expose progress counters.
- `GET /achievements/my` returns the caller's earned state and progress.
- `GET /achievements/full/:userId` remains as a compatibility route but is self-only. Cross-account requests return `403`.
- `POST /achievements/evaluate` evaluates the caller.
- `POST /achievements/evaluate/:userId` remains as a compatibility route but is self-only. It cannot trigger work for another account.

Clients should prefer `/achievements/my` and `/achievements/evaluate` for private progress operations.

## Failure and retry behavior

Provider failures are not converted into fake zero progress. Catalogue, earned-state, message-count, streak and award-store failures produce a stable `503` for request/response flows. This avoids presenting an outage as lost progress or a missing badge.

Event-driven evaluation is best-effort: failures are contained so sending a message or updating a study streak is not rolled back merely because achievement evaluation is temporarily unavailable. The next qualifying event safely retries because awarding is idempotent.

If several badges become due at once, all independent award attempts are allowed to settle. A partial failure is reported as unavailable, while successful inserts remain valid and are excluded on the next retry.

## Observability and privacy

Achievement logs use fixed operation identifiers such as `achievements.message_count_failed`, `achievements.award_write_failed` and `achievements.event_evaluation_failed`. They deliberately omit user IDs, provider/database error messages, message content, credentials and tokens. The batched-award failure log includes only the number of failed writes.

The service does not persist new telemetry or copies of user content. Achievement rows follow the existing `users` cascade lifecycle through `user_achievements.user_id`; no new retention policy is introduced by this change.

## Verification

Focused backend tests cover:

- canonical milestone seeding and thresholds;
- retry-safe award upserts;
- message and streak threshold evaluation;
- duplicate-award avoidance;
- provider-outage fail-closed behavior;
- partial batch failure and safe retry semantics;
- background event failure containment;
- sanitized diagnostics;
- self-only access to progress and manual evaluation.

The repository CI remains authoritative for TypeScript build, lint, backend unit/E2E tests and clean-environment validation.

## Rollout and rollback

No schema migration is required. The existing unique `(user_id, achievement_id)` constraint and indexes are the persistence contract used by the implementation. Deploy the backend normally; existing clients remain compatible with the HTTP paths and response shapes for authorized self requests.

Rollback is a code revert only. Existing achievement definitions and earned rows remain valid. If rolling back across this change, be aware that the previous compatibility endpoints allowed authenticated callers to request another user's progress or trigger another user's evaluation; retaining the self-only authorization check is preferred even during rollback.
