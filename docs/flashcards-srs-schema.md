# Flashcards SRS schema

Issue #971 establishes `supabase/migrations/004_flashcards_srs.sql` as the canonical bootstrap schema for learner flashcards.

## Data model and query contract

Each flashcard belongs to exactly one `public.users` row through `user_id`. Deleting a user cascades to their flashcards, so learner vocabulary and review history follow the account deletion lifecycle rather than becoming orphaned data.

`word_token` is required and may not be blank. The unique `(user_id, word_token)` index is both a query index and a correctness constraint: `FlashcardsService.createOrUpdateFlashcard` normalizes the token and uses PostgREST `upsert(..., { onConflict: 'user_id, word_token' })`. Concurrent or retried saves for the same normalized word therefore converge on one row instead of creating duplicates.

The base schema also contains the current SM-2 fields (`srs_level`, `easiness_factor`, `repetitions`, `interval_days`, and `next_review_at`) and the current content field names (`original_context`, `definition`, and `pronunciation_url`). The existing later compatibility migrations use conditional DDL, so they remain safe when replayed after this canonical bootstrap migration.

The initial `(user_id, next_review_at)` index supports per-user review-queue reads. `20260808000002_optimise_srs_indices.sql` later replaces that bootstrap index with the partial and covering indexes used by the production query shapes.

## Authorization and privacy

Flashcards contain private learner content. Row Level Security is enabled on `public.flashcards`, and SELECT, INSERT, UPDATE, and DELETE policies are restricted to the authenticated owner (`auth.uid() = user_id`). UPDATE has both `USING` and `WITH CHECK` clauses so a client cannot move an existing card into another user's ownership.

No anonymous policy is created. Backend operations using the Supabase service role continue to follow Supabase's documented service-role behavior and must enforce the authenticated user ID at the API/service layer as they do today.

## Deployment and verification

For a fresh database, run the Supabase migrations in repository order. For an existing environment, do not manually replay historical migrations in production; apply the normal migration sequence. The migration is written with `IF NOT EXISTS` and drop/recreate policy guards so development and CI rebuilds can retry it without duplicate-table, duplicate-index, or duplicate-policy failures.

Automated structural regression coverage lives in `backend/src/database/migrations/004_flashcards_srs.spec.ts`. In an environment with the Supabase CLI, a clean database reset is the integration check for the full migration chain. After deployment, verify that creating the same normalized token twice for one user updates a single row and that a second authenticated user cannot read, update, or delete that row.

## Rollback and recovery

This issue does not add a destructive production migration. Existing deployed databases keep their current table and data; the change primarily makes new/rebuilt environments start from the current schema contract. If bootstrap problems are discovered, revert the repository change before creating new environments. Do not drop `public.flashcards` in a populated environment as a rollback, because that would destroy learner vocabulary and SRS history.

If an index change needs to be reverted in an existing environment, use a new forward migration rather than editing migration history. Preserve the `(user_id, word_token)` uniqueness invariant while the application uses `onConflict: 'user_id, word_token'`.
