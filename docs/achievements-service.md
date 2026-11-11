# Achievements service

The NestJS `AchievementsService` owns the server-authoritative milestone catalogue and awards earned badges. The catalogue contains 12 badges across five progress sources:

| Source        | Badges (code: threshold)                                            | Progress is read from                                                       |
| ------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `messages`    | `first_message`: 1, `100_messages`: 100, `500_messages`: 500        | `chat_messages` sent by the learner                                         |
| `streak`      | `7_day_streak`: 7, `30_day_streak`: 30                              | `users.study_streak_days`                                                   |
| `corrections` | `first_correction`: 1, `25_corrections`: 25, `100_corrections`: 100 | `moment_comments` by the learner with a correction payload (as on My Stats) |
| `moments`     | `first_moment`: 1, `10_moments`: 10                                 | `moments` by the learner, stories included (as on My Stats)                 |
| `lessons`     | `first_lesson`: 1, `10_lessons`: 10                                 | `lesson_progress` rows of the learner with `completed = true`               |

The learner-facing view of recent unlocks and period-on-period activity is the [performance report](performance-reports.md).

## Evaluation flow

Achievement definitions are idempotently seeded on backend startup by achievement `code`. Evaluation is event driven and always reads the latest persisted progress rather than trusting client-provided counters. Each event names only the progress sources that just changed:

| Event                                   | Emitted by                                                                              | Sources evaluated    |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| `message.sent`                          | chat message delivery                                                                   | `messages`, `streak` |
| `achievements.evaluate` (no `sources`)  | `StudyStreakService` after a persisted streak update, and `POST /achievements/evaluate` | every source         |
| `achievements.evaluate` (`moments`)     | `MomentsService` after a Moment, language question or story is stored                   | `moments`            |
| `achievements.evaluate` (`corrections`) | `MomentsService` after a comment with a correction payload is stored                    | `corrections`        |
| `achievements.evaluate` (`lessons`)     | `LessonsService` after a lesson is saved as completed                                   | `lessons`            |

The payload type and source names live in `achievements.events.ts`. Unknown source names are ignored, and a request that names no known source does no work.

For each evaluation the service loads already-earned achievements, skips the source query for a source whose badges are all earned, reads the remaining requested sources once and in parallel, and attempts only newly due awards. `user_achievements` has a unique `(user_id, achievement_id)` constraint and the service uses an upsert on that pair, so repeated events, retries and concurrent evaluators cannot create duplicate awards. The upsert never rewrites `unlocked_at`, so a badge keeps the time it was first unlocked.

The same in-code milestone catalogue (`MILESTONES`) supplies seed metadata, source ownership and progress thresholds. This prevents the displayed `required` value from drifting away from the value used to award a badge.

`getFullAchievements` only queries the sources of the catalogue rows it returns, and `getUnlockedBetween(userId, start, end)` returns the caller's badges unlocked in a window (newest first, at most 50) for the performance report.

## Client copy

The API returns English `name` and `description` text from the catalogue. The Angular client resolves badge copy through `achievements.badge.<code>.name` and `achievements.badge.<code>.description` so it follows the interface language, and falls back to the server text for a code the dictionary does not know yet. Adding a badge therefore needs a catalogue entry, a threshold, and (for localised copy) the two dictionary keys.

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

Achievement logs use fixed operation identifiers such as `achievements.message_count_failed`, `achievements.correction_count_failed`, `achievements.moment_count_failed`, `achievements.lesson_count_failed`, `achievements.unlocked_read_failed`, `achievements.award_write_failed` and `achievements.event_evaluation_failed`. They deliberately omit user IDs, provider/database error messages, message content, credentials and tokens. The batched-award failure log includes only the number of failed writes.

The service does not persist new telemetry or copies of user content. Achievement rows follow the existing `users` cascade lifecycle through `user_achievements.user_id`; no new retention policy is introduced by this change.

Badges carry no monetary or ranking value. Because correction and Moment progress uses the same definitions as the My Stats dashboard, a learner can correct or post on their own content to advance those counters; the figures stay consistent between the dashboard, the badge progress and the report, and the existing per-route throttles bound how fast this can happen.

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
- self-only access to progress and manual evaluation;
- the stable catalogue thresholds and sources, per-source evaluation scoping and per-source fail-closed behaviour;
- the emitting write paths: Moments, language questions, stories and correction comments (`MomentsService`) and lesson completion (`LessonsService`);
- the bounded, caller-scoped unlocked-badge window read used by the report.

The repository CI remains authoritative for TypeScript build, lint, backend unit/E2E tests and clean-environment validation.

## Rollout and rollback

No schema migration is required. The existing unique `(user_id, achievement_id)` constraint and indexes are the persistence contract. Deploy the backend normally: the seven new badge definitions are upserted on startup and existing clients stay compatible with the HTTP paths and response shapes for authorised self requests.

Learners who already exceed a new threshold receive the badge on their next qualifying event or when they call `POST /achievements/evaluate`. Their `unlocked_at` is the time of that evaluation, not the time the threshold was crossed, so the first performance report after the rollout can list those badges as recently unlocked.

Rollback is a code revert only. Earned rows remain valid. After a revert, the older service lists every catalogue row it finds but only knows the original five thresholds, so the seven new definitions would appear with no progress target. To return to the earlier catalogue, remove them (earned rows cascade): `DELETE FROM achievements WHERE code IN ('first_correction', '25_corrections', '100_corrections', 'first_moment', '10_moments', 'first_lesson', '10_lessons');`. If rolling back across the earlier authorisation change, be aware that the previous compatibility endpoints allowed authenticated callers to request another user's progress or trigger another user's evaluation; retaining the self-only authorisation check is preferred even during rollback.
