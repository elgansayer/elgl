# Initial user schema contract

Issue #1660 tracks the historical `supabase/migrations/001_initial_schema.sql` baseline. The migration already exists on `main`; it must remain append-only so deployed environments and clean database replays see the same history. Future schema changes belong in new forward migrations rather than edits to `001_initial_schema.sql`.

## Baseline data model

`public.users` is keyed directly to `auth.users(id)` with `ON DELETE CASCADE`, so deleting the authentication identity removes its application profile. The baseline stores display/profile fields, native and target language preferences, CEFR proficiency, privacy flags, VIP/economy state, and learning-state fields including `study_streak_days` and `correction_ratio`.

Location and mock-location values use `GEOGRAPHY(POINT, 4326)`, allowing PostGIS distance queries without storing a separate derived distance. Application code must continue to respect the user's location/privacy settings before exposing location-derived results.

Later migrations extend this baseline substantially. Runtime code must target the fully migrated schema rather than assuming migration 001 alone describes the current production user model.

## Query and index contract

The baseline supplies GiST indexes for real and mock locations, a trigram GIN index for display-name search, and B-tree indexes for native-language, VIP, and serious-learner filtering. These indexes support the main discovery access paths but do not make unbounded discovery queries safe; API collection endpoints must remain bounded and paginated.

The `uuid-ossp`, PostGIS, and `pg_trgm` extensions are created with `IF NOT EXISTS`. The user table and every baseline index are also created with `IF NOT EXISTS`, and the migration contains no destructive `DROP`, `TRUNCATE`, or `DELETE` operation. This keeps clean replays and repeated local/bootstrap application non-destructive.

## Authorization and privacy

The NestJS API remains the primary application boundary. `009_row_level_security.sql` enables defence-in-depth RLS for `public.users`: authenticated users may read profiles, while direct authenticated updates are scoped to the row whose `id` equals `auth.uid()`. Migration `20260807000000_review_rls_virtual_coin_economy.sql` replaces that initial update policy with the effective policy, which preserves row ownership and additionally prevents direct changes to economy, VIP, admin, and API-key fields.

Service-role access bypasses RLS, so backend services must still enforce their application-level authorization and privacy rules. Location, mock location, private profile fields, tokens, credentials, and other personal data should not be emitted in routine logs. Operational logging should prefer sanitized error categories and request correlation IDs.

## Retention and deletion

The baseline user row is owned by the corresponding Supabase auth identity through an `ON DELETE CASCADE` foreign key. Account-deletion workflows should delete through the established auth/account lifecycle rather than independently orphaning profile state. Any future retention, legal-hold, or soft-delete behavior that changes this contract must be introduced through a new forward migration and documented with its rollout implications.

## Verification

`backend/src/database/initial-schema-migration.contract.spec.ts` protects the historical contract. It verifies required database extensions, auth ownership, PostGIS columns, language/profile fields, VIP/economy/learning defaults, discovery indexes, replay-safe DDL, absence of destructive statements, and the effective users RLS boundary. The RLS check also scans later migrations so disabling RLS or removing the hardened owner-update policy cannot silently leave this contract green.

Repository CI runs the backend Vitest suite together with database clean-reset/migration gates. A deployment verification should replay the full migration chain in a clean Supabase environment and confirm that spatial indexes are created, user rows remain tied to `auth.users`, an authenticated direct update cannot mutate another user's row, and sensitive user fields cannot be changed through the authenticated client role.

## Rollout and rollback

This completion change does not alter the deployed schema and requires no backfill. It strengthens executable verification and documents the baseline that is already in production.

Rollback is a normal revert of the regression contract/documentation commit. Do not edit or delete the historical `001_initial_schema.sql` migration to roll back verification-only changes. If production schema behavior must change, ship a new forward migration so existing and clean environments converge safely.
