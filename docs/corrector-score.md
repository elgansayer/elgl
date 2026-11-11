# Corrector score

The corrector score is a profile-level average of authenticated 1-5 ratings. One learner can hold one rating for another learner. Repeating a rating replaces the previous value, so client retries and concurrent upserts cannot create duplicate votes.

## API and profile contract

- `POST /corrector-score/rate` accepts a target user UUID and an integer score from 1 to 5. The authenticated user is always the rater, and self-ratings are forbidden.
- `GET /corrector-score/:userId` returns `averageScore` rounded to one decimal place and `totalRatings`.
- User profile responses include `corrector_score`, `corrector_rating_count`, and `corrector_score_unavailable`.
- A profile with zero ratings has a `null` score and renders the translated no-ratings state. An aggregation failure keeps the rest of the profile available and renders the translated unavailable state.
- Both the signed-in profile and the external user-detail profile display the aggregate. Individual ratings and rater identities are never returned.

## Persistence and security

Migration `20261108090000_create_corrector_ratings.sql` creates the indexed `corrector_ratings` table in the deployed Supabase migration chain. Foreign keys cascade on user deletion, so a deleted user's authored and received ratings follow the existing account-deletion lifecycle.

The unique `(rater_id, rated_user_id)` constraint makes rating writes idempotent. Database checks enforce the score range and reject self-ratings even if an application check is bypassed. Browser roles have no table or aggregate-function access. NestJS uses the service role and the typed `get_corrector_score` function, which performs aggregation in PostgreSQL and returns one bounded row.

Database and aggregation failures are logged with fixed diagnostic messages that contain no user identifiers, rating values, provider errors, credentials, or content.

## Rollout and rollback

Apply the additive migration before deploying the backend that calls `get_corrector_score`, then deploy the frontend profile state handling. Older application versions remain compatible because the table columns and existing HTTP routes are preserved.

For application rollback, restore the previous backend and frontend first. The additive table and function can remain safely deployed. A later reviewed migration may remove them only after confirming no supported application version calls the score API. Do not edit or remove the deployed migration file.

## Focused verification

- `backend/src/database/migrations/corrector-score-migration.contract.spec.ts` verifies persistence, indexes, constraints, aggregate access, and browser-role denial.
- Corrector controller, DTO and service specs verify authentication decisions, validation, idempotent writes, bounded aggregation, malformed responses and provider failures.
- Users service specs verify profile composition and partial-failure behaviour.
- Angular user service, own-profile and external-profile specs verify request failure propagation and all visible score states.
