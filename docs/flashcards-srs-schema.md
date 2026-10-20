# Flashcards SRS schema

Issue #971 introduced the historical `supabase/migrations/004_flashcards_srs.sql` table and its `(user_id, word_token)` index. Repository migration history is append-only, so the original migration remains unchanged. `20260821080200_harden_flashcards_srs_contract.sql` is the forward migration that brings existing and newly replayed databases to the production contract used by the current flashcard service.

## Data model and query contract

Each flashcard belongs to exactly one `public.users` row through `user_id`. Deleting a user cascades to their flashcards, so learner vocabulary and review history follow the account deletion lifecycle rather than becoming orphaned data.

The historical migration creates the requested `(user_id, word_token)` composite index. The production contract upgrades that invariant to a unique index because `FlashcardsService.createOrUpdateFlashcard` normalizes the token and uses PostgREST `upsert(..., { onConflict: 'user_id, word_token' })`. Concurrent or retried saves for the same normalized token therefore converge on one row instead of creating duplicates.

The forward migration also converges historical column names (`next_review_date`, `context_sentence`, and `audio_pronunciation_url`) to the names consumed by the current application, ensures the current SM-2 fields exist, adds the optional `definition` field, and relaxes legacy `NOT NULL` requirements for `source_language` and context because current API writes legitimately omit them.

`20260808000002_optimise_srs_indices.sql` remains responsible for the optimized partial and covering SRS indexes used by the high-frequency review/query paths. The #971 forward migration does not replace those query-performance indexes.

## Write API contract

`POST /api/flashcards` saves a word for the authenticated learner. The server derives `user_id` exclusively from the verified Supabase principal; callers cannot choose another owner. `word_token` and `translation` are required and are trimmed before validation. User-controlled text is bounded (`word_token` 200 characters, translation 500, context and definition 1,000 each), and pronunciation media must be an absolute HTTP(S) URL no longer than 2,000 characters. Saving the same normalized token again is idempotent at the database boundary because the `(user_id, word_token)` conflict target is unique.

`PATCH /api/flashcards/:id/srs` submits an SM-2 recall quality score from 0 through 5. The route accepts UUID v4 flashcard identifiers only, and `FlashcardsService.updateSrsLevel` scopes both its read and update by the authenticated `user_id`, preventing cross-account review changes. The endpoint inherits the existing SRS rate limiter and the global DTO validation pipe.

Both write endpoints are `Cache-Control: no-store`. If a Supabase connectivity failure activates the established local SRS fallback, the response carries `X-SRS-Degraded: true`; clients should treat that state as locally computed/pending rather than confirmed durable persistence. Missing authenticated principals fail closed with HTTP 401 even if a guard or decorator is accidentally misconfigured upstream.

## Authorization and privacy

Flashcards contain private learner content. Row Level Security is enabled on `public.flashcards`. The forward migration recreates SELECT, INSERT, UPDATE, and DELETE policies explicitly for the authenticated owner (`auth.uid() = user_id`). UPDATE has both `USING` and `WITH CHECK` clauses so a client cannot move an existing card into another user's ownership.

No anonymous policy is created. Backend operations using the Supabase service role continue to follow Supabase service-role behavior and must enforce the authenticated user ID at the API/service layer as they do today.

The write API does not log request bodies, translations, definitions, context, or pronunciation URLs at the controller boundary. Existing service diagnostics should remain limited to operational identifiers required to correlate failures and must not expose authentication tokens or request credentials.

## Deployment and verification

Run Supabase migrations in repository order. Do not replay or edit historical migrations in a deployed environment. The new forward migration uses conditional renames, `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, and drop/recreate policy guards so it is safe across the known historical and current schema shapes.

The unique-index step intentionally fails if an old environment contains duplicate `(user_id, word_token)` rows. That is a fail-closed condition: deduplicate the affected user's rows deliberately, preserving the desired SRS state, and then retry the migration rather than allowing ambiguous upsert behavior.

Automated structural regression coverage lives in `backend/src/database/migrations/004_flashcards_srs.spec.ts`. Controller coverage in `backend/src/flashcards/flashcards.controller.spec.ts` locks authenticated write scoping and degraded-response signaling. DTO coverage in `backend/src/flashcards/dto/flashcard.dto.spec.ts` locks normalization, bounds, URL validation, and the 0–5 SRS quality range. CI also runs the repository's clean Supabase reset for database-sensitive changes.

After deployment, verify that creating the same normalized token twice for one user leaves one row, that malformed/oversized payloads and malformed flashcard IDs return HTTP 400, that unauthenticated writes return HTTP 401, and that a second authenticated user cannot update another user's flashcard.

## Failure handling and observability

The existing service retries transient datastore failures and exposes its degradation state through `/api/flashcards/health`. A degraded write is explicit through both the response model's `degraded` marker and the `X-SRS-Degraded` response header. Validation and authentication failures are rejected before database work, reducing noisy backend failures and avoiding ambiguous successful `null` responses.

Operators should correlate elevated `supabase-flashcards-write` degradation, SRS write latency/failure metrics, and service logs before assuming learner review state is durable. Flashcard content should not be copied into new metrics or tracing attributes.

## Rollback and recovery

The forward migration does not drop the flashcards table or learner rows. If a rollout must be reversed, use a new forward migration rather than editing migration history. Do not drop `public.flashcards` in a populated environment because that would destroy learner vocabulary and SRS history.

Any rollback must preserve `(user_id, word_token)` uniqueness while the application uses that PostgREST conflict target. If a compatibility column needs to be restored for an older application version, add it or relax its constraint in a forward migration, deploy the compatible application version, and only remove obsolete schema in a later cleanup after mixed-version traffic has ended.

The API hardening in #1341 is additive at the contract boundary and requires no data rollback. If an older client depends on whitespace-only content, malformed IDs, or non-HTTP pronunciation URLs, fix that client rather than weakening the server validation. A code rollback is otherwise a normal revert; no schema migration is introduced by #1341.
