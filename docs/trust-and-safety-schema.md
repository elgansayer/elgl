# Trust and safety schema contract

Issue #1290 is implemented by `supabase/migrations/002_trust_and_safety.sql`, with defence-in-depth row-level security in `supabase/migrations/009_row_level_security.sql`.

## Data model

The migration establishes three trust and safety tables:

- `profile_visits` records who viewed which profile and when. Both user references cascade on account deletion, and the `(viewed_id, created_at DESC)` index supports bounded newest-first visitor history queries.
- `blocks` records directional user blocks. A unique `(blocker_id, blocked_id)` constraint makes repeated block attempts idempotent, while indexes support lookups in either direction.
- `reports` records moderation reports. Reporter deletion uses `ON DELETE SET NULL` so an account deletion does not erase moderation history; deletion of the reported account cascades its reports. New reports start in `pending` state.

All table and index creation uses `IF NOT EXISTS`, so historical replay is safe. The migration contains no destructive `DROP` or `TRUNCATE` operations.

## Security and privacy

The Angular client does not connect directly to these tables. NestJS remains the application API boundary.

Migration `009_row_level_security.sql` provides defence-in-depth policies for future or accidental authenticated Supabase access:

- profile visits can only be inserted by the visitor and read by the visitor or viewed user;
- blocks can only be selected, inserted, or deleted by the blocker;
- reports can only be inserted or selected by the reporter.

Moderation access through the backend remains governed by the repository's separate server-side admin authorization controls. Application logs must not include report descriptions or other private trust and safety payloads unless explicitly redacted and required for an operational diagnostic.

## Verification

`backend/src/database/migrations/002_trust_and_safety.spec.ts` locks the historical schema contract by verifying:

- table shape and deletion semantics for profile visits, blocks, and reports;
- duplicate-block protection and bounded-query indexes;
- pending report status and reporter privacy semantics;
- replay safety and absence of destructive SQL;
- authenticated owner-scoped RLS coverage for all three tables.

The repository's normal database clean-reset, backend unit/lint/build/E2E, and required CI workflows remain authoritative before merge.

## Rollout and rollback

This completion change adds regression coverage and documentation only. It does not alter an already-applied production schema.

Do not roll back the historical migration by deleting or editing deployed tables. If a future schema correction is required, add a new forward migration. This contract test and documentation can be reverted independently without changing production data.
