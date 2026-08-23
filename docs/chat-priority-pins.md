# Priority chat pins

Issue #1167 adds private, per-user priority pins to the chat inbox.

## Product behaviour

A learner can pin or unpin any chat room they are currently a member of. Pinned chats render before unpinned chats in the inbox. Existing last-message recency order is preserved within the pinned and unpinned groups, so pinning changes priority without destroying the normal conversation ordering.

Pin state belongs to the learner, not the room. Pinning a shared chat therefore does not change another member's inbox. Locked chats remain in the locked-chat folder and pinning does not bypass the existing unlock flow. Search and inbox filters continue to operate normally, with pinned matching chats ordered before unpinned matching chats.

The frontend waits for the server mutation to succeed before changing the visible pin state. A failed request keeps the prior state and displays the existing generic failure feedback. If pin-state loading is unavailable, the inbox remains usable in normal recency order and does not trust the historical room-wide `is_pinned` value.

## API

All endpoints use the existing `SupabaseAuthGuard` and the authenticated user identity. The pin endpoints are additionally throttled to 30 requests per minute.

- `GET /api/chat/pinned-rooms` returns at most 100 room IDs owned by the authenticated learner's pin collection.
- `PUT /api/chat/rooms/:roomId/pin` accepts `{ "is_pinned": boolean }` and returns the authoritative room ID and pin state.

The backend verifies current `chat_room_members` membership before every mutation. A non-member receives the same not-found response as an unknown room. Pin uses an upsert and unpin uses a scoped delete, making repeated client retries idempotent.

## Data and privacy

`chat_room_pins` stores only `user_id`, `room_id`, and `created_at`. It contains no message content, profile text, tokens, or provider data. Rows cascade when either the user or room is deleted.

RLS permits an authenticated learner to read, insert, or delete only their own rows. Read and insert policies additionally require current membership in the referenced room. Anonymous access is revoked. The API also performs membership verification because the backend service-role client bypasses RLS.

The historical `chat_rooms.is_pinned` field is deliberately left intact for mixed-version compatibility. During migration, existing shared pins are copied once to each current room member with `ON CONFLICT DO NOTHING`. New application code writes only `chat_room_pins`.

No pin action logs message contents or other private conversation data.

## Failure and recovery

- Pin-list database failure: the backend returns an unavailable error. The frontend preserves the usable inbox and treats all rooms as unpinned until a later reload succeeds.
- Membership lookup failure: the mutation fails closed rather than guessing membership.
- Duplicate pin: the upsert leaves a single `(user_id, room_id)` row.
- Duplicate unpin: deleting an absent row remains successful and the authoritative result is unpinned.
- Mutation database failure: the frontend leaves the existing visible state unchanged so retry is safe.

## Rollout

1. Apply `20260823010000_chat_room_pins.sql`.
2. Deploy the backend with `ChatPinsController` and `ChatPinsService`.
3. Deploy the Angular client and inbox controls.
4. Smoke-test two users in the same room and confirm one user's pin does not change the other's ordering.
5. Confirm a repeated pin and repeated unpin produce one row and no error.
6. Confirm a non-member cannot create a pin for another room.

The migration is additive and replay safe. Old application versions continue to read the existing room model during a mixed-version deployment.

## Verification

Relevant automated coverage includes:

- `backend/src/chat/chat-pins.service.spec.ts`
- `backend/src/chat/chat-pins.controller.spec.ts`
- `backend/src/database/migrations/20260823010000_chat_room_pins.spec.ts`
- `frontend/src/app/services/chat-pins.service.spec.ts`
- `frontend/src/app/components/chat-list/chat-list.component.spec.ts`

Repository CI remains authoritative for clean Supabase replay, backend and frontend unit suites, static analysis, builds, design governance, dependency review, and E2E contracts.

## Rollback

Disable or revert the frontend pin controls first, then revert the backend route registration if required. Leave the additive `chat_room_pins` table and migrated preference rows in place during a routine application rollback because they are harmless to older code and preserve user intent for a later redeploy.

Do not restore new writes to the shared `chat_rooms.is_pinned` field. Dropping the table should require a separate reviewed migration with an explicit decision to discard user preferences.
