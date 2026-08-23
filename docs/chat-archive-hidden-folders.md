# Chat archive and hidden folders

Issue: #1168

## Product contract

Chat folders are private **per-member inbox preferences**. Archiving or hiding a room never changes the room for the other participants and never deletes messages.

- **Inbox** contains rooms that are neither archived nor hidden for the current member.
- **Archived chats** remain readable and searchable through the normal room route, but are removed from the primary inbox until restored.
- **Hidden chats** reuse the existing chat-lock preference (`chat_room_members.is_locked`). They are omitted by the normal room-list API. The first-party client requests hidden room details only after its local app-unlock flow succeeds.
- If a room is both archived and hidden, the hidden folder wins so the archive folder does not reveal it before the local unlock flow.
- Archive/unarchive mutations are desired-state operations and are safe to retry.

The historical `chat_rooms.is_archived` field is intentionally not used. It is shared room state and would archive a conversation for every member.

## API

All folder endpoints require `SupabaseAuthGuard` and return `Cache-Control: no-store`.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/chat/folders/archived` | Returns at most 200 rooms archived by the authenticated member. |
| `POST` | `/chat/folders/archived/:roomId` | Archives the caller's membership only. |
| `DELETE` | `/chat/folders/archived/:roomId` | Restores the caller's membership only. |
| `GET` | `/chat/folders/hidden` | Returns at most 200 rooms locked/hidden by the authenticated member. |

Mutation room IDs are UUID-validated. A room that exists but is not joined by the caller is reported with the same not-found response as an unknown room, avoiding membership disclosure.

## Data model and query pattern

`chat_room_members.is_archived boolean NOT NULL DEFAULT false` is the canonical archive state. The migration also converges `is_locked` into the Supabase migration history because older deployments introduced that field through the backend migration path.

Partial indexes support the bounded folder scans:

- `(user_id, joined_at DESC) WHERE is_archived = true`
- `(user_id, joined_at DESC) WHERE is_locked = true`

No message content is copied or duplicated. Folder state cascades naturally with the existing membership row when a user leaves a room or the room is deleted.

## Privacy and security

The backend uses its service-role Supabase client, so every folder mutation independently scopes the write to both `user_id` and `room_id`; browser-supplied ownership is never trusted. Folder reads first resolve room IDs from the authenticated member row and only then fetch room metadata.

Hidden chats are an **in-app privacy/organisation feature, not cryptographic storage protection**. The local app-unlock/biometric flow prevents accidental disclosure in the first-party UI, but a valid account session remains capable of calling its own authenticated API. Message confidentiality therefore continues to rely on the account/session security model.

Folder endpoints do not log message text, room titles, tokens, or membership IDs. Store failures are returned as stable unavailable responses instead of raw provider/database errors.

## Failure behavior

- Failed archive/unarchive requests do not optimistically change folder state in the UI and can be retried safely.
- A folder-store outage returns an unavailable response instead of a false empty result.
- Hidden room details are not requested by the first-party client until local app unlock succeeds.
- If archived-folder loading fails, the active inbox remains usable and the failure is reported; no messages are deleted or rewritten.
- Empty folders avoid a second room-detail query.

## Accessibility

Folder controls use native buttons with at least 44px touch targets, `aria-expanded` on collapsible folders, semantic section labels, text plus icons rather than colour-only state, and sibling action buttons rather than nested interactive controls inside room links. The layout remains single-column and reflows at high zoom.

## Verification

Automated coverage includes:

- backend membership scoping, non-member behavior, persistence failure handling, bounded folder reads, ordering, and empty-folder behavior;
- typed Angular API calls, authentication, mutation error propagation, and no unauthenticated reads;
- chat-list archive state, server-first mutation behavior, hidden-folder unlock gating, and hidden-room detail loading;
- clean Supabase migration replay through the repository CI database gate.

Manual smoke test after deployment:

1. Sign in as two members of the same direct or group room.
2. Archive the room as member A and confirm it leaves A's inbox, appears under Archived, and remains in member B's inbox.
3. Restore it and confirm it returns to A's inbox.
4. Lock/hide the room as A and confirm normal room listing omits it.
5. Open the hidden folder; confirm the app-unlock flow occurs before room details are displayed.
6. Unlock the room and confirm it returns to the normal inbox.
7. Retry archive and restore requests and confirm no duplicate state or message changes occur.

## Rollout

1. Apply `20260823020500_chat_member_archive_folders.sql`.
2. Deploy the backend folder service/controller.
3. Deploy the Angular client.
4. Run the two-member smoke test above and monitor normal API status/latency telemetry for `/chat/folders/*`.

The migration is additive and safe with older clients. Older clients ignore `is_archived`; newer clients continue using the existing lock endpoints for hidden-state mutations.

## Rollback

Remove the Angular archive controls first, then revert the backend folder controller/service if necessary. Leave the additive `is_archived`/`is_locked` member columns and indexes in place during a normal rollback so user folder intent is preserved and older application versions remain compatible. Do not repurpose `chat_rooms.is_archived` as a rollback shortcut because it has different shared-room semantics.
