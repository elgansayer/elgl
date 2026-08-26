# Chat and favourites schema contract

Issue #963 introduced the historical `supabase/migrations/003_chat_and_favourites.sql` baseline. The migration already exists on `main`; it must remain append-only so deployed environments and clean database replays see the same history. Future schema changes belong in new forward migrations rather than edits to `003_chat_and_favourites.sql`.

## Baseline data model

`public.chat_messages` stores the canonical message row created by the original chat implementation. Each row has a generated UUID, a room identifier, an authenticated sender reference, message type, optional text/media/correction payload, read state, and creation timestamp. Deleting the sender cascades to their message rows at this historical layer.

`public.favourites` stores a user's saved-message relationship. It references both `public.users` and `public.chat_messages` with cascade deletion and enforces one favourite per `(user_id, message_id)`. The optional `note_text` belongs to the favourite record, not the underlying message.

Later migrations may add room membership, message lifecycle fields, or stricter authorization. Application code must always target the fully migrated schema, not assume the historical file alone describes current production state.

## Query and index contract

The baseline migration supplies indexes for the primary access paths:

- `(room_id, created_at ASC)` for ordered room history;
- `sender_id` for sender-scoped message lookup and cleanup;
- a `GIN` trigram index on `text_content` for text search, backed by `pg_trgm` from `001_initial_schema.sql`;
- `(user_id, created_at DESC)` for a user's newest favourites.

The unique `(user_id, message_id)` constraint is also the concurrency boundary for duplicate favourite attempts. Callers should treat a repeated favourite mutation as idempotent at the product layer rather than creating duplicate rows.

Collection APIs must still use bounded pagination. These indexes make the expected access paths efficient but do not make unbounded history or search requests safe.

## Authorization and privacy

The NestJS API remains the primary application boundary. `009_row_level_security.sql` adds defence-in-depth RLS for both tables. The historical chat policy permits authenticated inserts only when `auth.uid()` equals `sender_id`; favourites are selectable, insertable, and deletable only by their owning `user_id`.

Room-membership authorization can evolve in later migrations as the chat model grows. Do not weaken a newer membership-aware policy merely to match this historical baseline. Service-role access in the backend must continue to enforce the application-level authorization checks before reading or mutating user content.

Message text, correction payloads, favourite notes, tokens, credentials, and private room identifiers should not be emitted in routine logs. Operational logging should use sanitized error categories and request correlation IDs where available.

## Retention and deletion

The original foreign keys use `ON DELETE CASCADE`:

- deleting a user removes message rows authored by that user;
- deleting a user removes that user's favourite rows;
- deleting a message removes favourites pointing at that message.

Any future retention, soft-delete, legal-hold, or account-deletion workflow that changes these semantics must do so in a new migration and update this documentation or a successor data-lifecycle document.

## Verification

`backend/src/database/migrations/003_chat_and_favourites.spec.ts` protects the historical contract. It verifies both table shapes, the four baseline indexes, `pg_trgm` availability, duplicate-favourite protection, non-destructive retry characteristics, and the matching defence-in-depth RLS declarations.

Repository CI runs the backend Vitest suite and database clean-reset/migration gates. For a deployment verification, replay the full Supabase migration chain in a clean environment and confirm that:

1. room-history queries use the room/time index;
2. duplicate `(user_id, message_id)` favourites are rejected;
3. deleting a message removes its favourites;
4. an authenticated user cannot create a favourite owned by another user;
5. authorization behavior reflects the latest migration state, including any room-membership hardening that landed after migration 003.

## Rollout and rollback

This completion change does not alter the deployed schema and requires no backfill. Deploy it through the normal application/CI path.

Rollback is a normal revert of the regression test and this document. Do not edit or delete the historical `003_chat_and_favourites.sql` migration to roll back verification-only changes. If a future production schema correction is required, ship a new forward migration so both existing and clean environments converge safely.
