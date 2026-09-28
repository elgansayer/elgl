# Favourites bookmarking

Issue #1332 completes the saved-message and correction bookmarking path exposed by `POST /chat/favourites`, `GET /chat/favourites`, `DELETE /chat/favourites/:id`, and the Angular `FavouritesComponent`.

## Data model and compatibility

The historical `003_chat_and_favourites.sql` migration remains append-only. Its `(user_id, message_id)` relationship is still the canonical favourite identity and continues to provide cascade deletion plus duplicate protection.

`20260823160100_harden_chat_favourites.sql` adds the application-facing `item_type`, `item_payload`, and `notes` fields already consumed by the Angular UI. Existing rows are backfilled from their canonical message relation. A database trigger keeps the old relational shape and the newer snapshot-shaped API synchronized, so mixed-version clients can be deployed without rewriting historical migrations.

For message favourites, `item_type` is server-authoritative and always normalizes to `message`. A correction remains a chat message whose canonical `message_type` is `correction`, so the existing visual-diff renderer can review it without a second persistence model.

## Authorization and privacy

Authentication remains mandatory on both the `/chat/favourites` routes and the legacy `/favourites` compatibility routes. The database write boundary verifies that `favourites.user_id` is currently a member of the message room before accepting a bookmark. This check is intentionally implemented below the NestJS service layer because the backend's service-role Supabase client bypasses RLS.

The compatibility `GET /favourites/user/:userId` endpoint now rejects attempts to read another user's favourites. New clients should use the current-user `GET /favourites` or canonical `GET /chat/favourites` route instead.

Favourite payloads are rebuilt from the canonical `chat_messages` row rather than trusting client-provided JSON. Sender identity needed by the review UI is attached from `users`. For view-once messages, `media_url` is stripped before the snapshot is stored so bookmarking cannot turn expiring media into a reusable URL.

Favourite notes are bounded to 500 characters at both DTO validation and the database write boundary. Application and database failures must not log message text, correction payloads, notes, media URLs, tokens, or other private content.

## Retry and concurrency behavior

A bookmark is identified by `(user_id, message_id)`. The historical unique constraint remains the final integrity guard. The normalization trigger also takes a transaction-scoped advisory lock for that relationship and converts a repeated insert into an update of the existing snapshot/note. Retried POST requests therefore remain idempotent under concurrent delivery rather than creating duplicates or surfacing a uniqueness error.

Deletion is owner-scoped. The Angular UI disables duplicate deletion attempts while a request is pending and keeps the item visible if the request fails so the user can retry safely.

## UI states and accessibility

`FavouritesComponent` provides tabbed review for text messages, corrections, voice items, and any compatible saved content already present in the account. Text is rendered through Angular interpolation; correction content uses the existing visual-diff component.

Loading failures are no longer presented as an empty collection. The page exposes an assertive error message and keyboard-accessible Spartan retry action. If a refresh fails after data was already loaded, the stale list remains reviewable while the error is shown. Delete failures also leave the favourite intact and expose an accessible failure message. Loading and mutation controls retain their existing busy/disabled semantics and touch-sized actions.

## Retention and deletion

The canonical foreign keys remain unchanged:

- account deletion cascades the user's favourites;
- message deletion cascades favourites for that message;
- removing an individual favourite deletes only that user's relationship.

The snapshot columns do not create an independent retention lifetime. They belong to the same favourite row and disappear with it.

## Verification

Automated coverage added or activated by this change includes:

- DTO validation for UUID identifiers and the 500-character note boundary;
- migration-contract tests for canonical payload rebuilding, room-membership authorization, view-once protection, and retry serialization;
- controller coverage proving the legacy user-scoped read cannot expose another account;
- active Angular API-client tests for add/list/delete requests;
- component regression tests for load failure, retry recovery, delete failure, and busy-state cleanup;
- the existing `FavouritesComponent` tests for filtering, corrections, audio playback, deletion deduplication, list semantics, and accessible controls.

Repository CI should also run the full clean Supabase replay because the feature depends on the forward migration and the historical unique constraint.

## Rollout and rollback

Deploy the migration before or alongside the application changes. It is additive and supports both the historical `message_id`/`note_text` writer shape and the current `item_payload`/`notes` shape.

To roll back application code, older clients can continue using the canonical relational columns because the migration keeps them synchronized. Do not edit or remove migration `003_chat_and_favourites.sql`. After production data has been written through the new migration, leave the additive columns and trigger in place during an application rollback; removing them would require a separate forward migration and a data-compatibility review.
