# Chat archiving and hidden folders

Issue #1685 adds a per-account archive state for chat rooms. Archiving is an inbox-organisation action: it hides a conversation from the member's main chat list without deleting messages, changing membership, muting notifications, or changing the room for other participants.

## Data model

`chat_room_members` owns the archive state because archive visibility is personal. The migration adds:

- `is_archived boolean NOT NULL DEFAULT false`
- `archived_at timestamptz`, required while archived and cleared on restore
- a partial `(user_id, archived_at DESC)` index for bounded archived-room lookups

The older `chat_rooms.is_archived` column is deliberately not reused. It is room-global and changing it for a personal archive action would hide the room for every participant. Existing clients continue to see rooms normally until they opt into the new membership state, which keeps the migration compatible with mixed-version deployments.

Archive state has the same retention lifetime as the corresponding room membership and is deleted automatically when the membership row is removed.

## API contract

All endpoints are protected by `SupabaseAuthGuard` and derive the account ID from the authenticated Supabase user.

- `GET /api/chat/archived-rooms` returns at most 500 unique room UUIDs, newest archive first.
- `POST /api/chat/rooms/:roomId/archive` archives the caller's membership.
- `POST /api/chat/rooms/:roomId/unarchive` restores the caller's membership.

Archive and restore are idempotent. Mutations require a UUID v4 room identifier and current room membership, are throttled to 20 requests per minute, and constrain the update by both `room_id` and authenticated `user_id`. A participant therefore cannot archive another participant's copy of a conversation.

Database/provider failures return a stable unavailable response rather than raw Supabase details. Logs contain only event classifications such as `chat_archive_update_failed`; they do not contain room IDs, user IDs, message text, tokens, or provider error bodies.

## Client behaviour

The chat list loads the authoritative archive ID set independently from cached room data. Archived rooms are removed from the main inbox and appear under a collapsed **Archived chats** folder. The folder is user-controlled and does not reveal locked chats: if a room is both locked and archived, the existing locked-chat boundary takes precedence.

Archive writes are server-confirmed before local state changes. Per-room in-flight suppression prevents rapid duplicate/conflicting archive requests. A failed request leaves the room in its previous location and remains immediately retryable.

Archive-list loading fails closed. If the client cannot determine which chats are archived, it does not render the normal inbox because that could expose a conversation the user intentionally hid. The UI exposes a retry action instead.

Archiving does not change read state, notification preferences, message delivery, offline queueing, or unread totals. New messages do not automatically unarchive a room; restoring the room is an explicit account action.

## Accessibility and international content

Archive and restore controls keep a minimum 44px touch target, expose busy state, and stop propagation so activating them does not also open the room. The folder exposes `aria-expanded`/`aria-controls`, and mutation outcomes are announced through a polite live region. User-controlled room names and previews use `dir="auto"` so mixed RTL/LTR text remains readable.

## Verification

Automated coverage includes:

- authenticated membership enforcement
- bounded and de-duplicated archived-room reads
- idempotent archive retries
- restore timestamp clearing
- sanitized provider-failure handling
- client authentication and UUID validation before network access
- malformed/duplicate archive response rejection
- validated archive/restore acknowledgements

A clean Supabase replay should apply `20260827115800_chat_room_member_archives.sql` after the existing chat membership schema and RLS migrations.

## Rollout and rollback

Deploy the additive migration before or with the backend. Old application versions ignore the new columns, while new versions can safely use them immediately. The frontend can be deployed after the API is available.

Application rollback requires no data rewrite: old clients ignore membership archive state. If the feature is permanently removed, first deploy code that no longer reads the fields, then drop `idx_chat_room_members_user_archived_at`, the archive timestamp constraint, and the two columns in a later migration. Do not repurpose the room-global `chat_rooms.is_archived` field during rollback.
