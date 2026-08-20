# Trust and safety schema contract

Issue #947 introduced the baseline trust and safety persistence layer in `supabase/migrations/002_trust_and_safety.sql`. The migration is intentionally kept as an immutable historical migration. Later migrations may harden or extend the schema, but deployments must continue to be able to replay the original migration sequence from an empty database.

## Tables

### `profile_visits`

Stores a visit from `visitor_id` to `viewed_id` with a server-generated timestamp. Both user references use `ON DELETE CASCADE`, so deleting either account removes the associated visit rows. The `(viewed_id, created_at DESC)` index supports recent-visitor queries without scanning the table, while the `visitor_id` index supports reverse lookups and account cleanup.

### `blocks`

Stores directed user blocks. `(blocker_id, blocked_id)` is unique, making a repeated block request idempotent at the persistence boundary. Both directions are indexed because safety checks need to determine both who a user blocked and who blocked that user. Account deletion cascades to associated block rows.

### `reports`

Stores moderation reports in the `pending` state by default. Reports are indexed by `reported_user_id` and `status` to support moderation queues. Deleting a reporter sets `reporter_id` to `NULL` so the report can remain without retaining the reporter account reference. Deleting the reported account currently cascades the report row; changing that retention rule requires a deliberate follow-up migration and privacy review.

## Authorization

`supabase/migrations/009_row_level_security.sql` enables row-level security for all three tables. Authenticated clients can only read or mutate rows within the owner-scoped policies defined there. The NestJS backend normally uses the service-role boundary, so application authorization must still be enforced in backend services and controllers; RLS is defence in depth rather than a substitute for API authorization.

## Verification

Run:

```bash
npm run check:trust-safety-schema
```

The contract test verifies that the historical migration still creates all three tables, preserves the intended foreign-key deletion semantics, supplies the indexes used by production query paths, keeps duplicate blocks impossible, and has matching owner-scoped RLS coverage.

The repository database clean-reset workflow remains the authoritative integration check that the complete migration corpus replays successfully against PostgreSQL/Supabase.

## Rollout and rollback

This baseline migration is forward-only once deployed. Do not rewrite or delete `002_trust_and_safety.sql` to change a live schema. Apply corrections with a new migration so both existing environments and clean database replays converge on the same state.

A rollback of application code must remain compatible with the deployed tables. Destructive table rollback is not part of the normal release path and requires a separate data-retention and recovery plan.
