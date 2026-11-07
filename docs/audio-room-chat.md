# Live-room text chat

Live-room text chat uses Supabase for recovery and Centrifugo for low-latency delivery. Angular never publishes room messages directly.

## Send and recovery flow

1. A client joins through `POST /audio-rooms/token`, which records `audio_room_participants`.
2. The client loads up to 50 recent rows from `GET /audio-rooms/:roomId/messages`.
3. The composer generates a UUID `client_message_id` and sends it with bounded plain text to `POST /audio-rooms/:roomId/messages`.
4. The API verifies participation and active-room state, persists the canonical row, then publishes `{ type: "chat_message", message }` to `room_{roomId}`.
5. The sender and other participants deduplicate history, HTTP responses and realtime delivery by the persisted message ID.
6. Once the server confirms the `room_{roomId}` subscription, the client merges the newest page in again. The history snapshot can predate the subscription (a speaker may still be answering the microphone prompt), and a message published in between would otherwise be in neither.
7. After a dropped realtime connection returns, the client merges the newest page in again, because Centrifugo does not replay what was published while it was away.

Only persisted participants can read or send. Participation means the account has joined: leaving the room does not remove the `audio_room_participants` row, so access ends only when the room ends (sending) or is deleted (reading). A room id that is not a UUID answers `400`, an unknown room answers `404`, a participant of an ended room answers `400` on send and may still read history, and an account that never joined answers `403`. The send route is limited to 20 requests per minute and history to 60 requests per minute in addition to the global API throttle. Text is trimmed, must contain a non-whitespace character and is limited to 1,000 characters. Logs contain room and message correlation IDs, never message text or credentials.

The sender name is a snapshot of the account display name at send time, read with a single display-name lookup rather than a full profile load. It is stored on the row so later renames do not rewrite history.

## Failure and retry behaviour

Database failure leaves no fabricated local message and returns a retryable service error. If persistence succeeds but Centrifugo rejects delivery, the API returns a service error while keeping the row. Repeating the same `client_message_id` republishes that row without inserting a duplicate. Reusing a retry key for different text is rejected.

History failure, or a failed catch-up after a subscription or reconnect, leaves the realtime subscription active and exposes one retry action that repeats only the part that failed. Messages already on screen stay visible. Send failure keeps the draft and retry key so the next submission is idempotent.

## Client behaviour

The message log is an accessible `role="log"` region that announces new messages politely. Each message keeps its sender and body in `dir="auto"` so Arabic, Hebrew and Persian bodies read in the correct direction without mirroring the surrounding layout. The panel scrolls to the newest message while the participant is reading the tail of the conversation and stops following once they scroll back, so an incoming message never yanks the reading position. Returning from the subtitles tab starts at the newest message again.

The composer stays focusable while a message is in flight (it is read-only, not disabled), and focus returns to it after each send, successful or not, so a keyboard participant can keep typing and a kept draft is ready to retry. Enter does not send while an input method editor is composing, so a confirmed CJK candidate never sends a half-written message. A message is shown only in the room it belongs to, so a slow response can never surface after the participant has moved to another room.

## Observability

The global HTTP metrics already export request volume, status and latency for the route templates `GET /audio-rooms/:id/messages` and `POST /audio-rooms/:id/messages`, so a spike in volume or in `503` answers is visible without extra instrumentation.

Failures also emit one structured warning each, keyed by `event` and carrying the `roomId` (and `messageId` where one exists) plus the database error code where there is one, never message text:

| Event | Meaning |
| --- | --- |
| `audio_room_chat_room_lookup_failed` | The room could not be read, so access was refused with `503`. |
| `audio_room_chat_participant_lookup_failed` | Participation could not be read, so access was refused with `503`. |
| `audio_room_chat_history_failed` | The history query failed (`503`). |
| `audio_room_chat_history_invalid` | The history query returned rows of an unexpected shape (`503`). |
| `audio_room_chat_persistence_failed` | The row could not be saved, nothing was published (`503`, safe to retry). |
| `audio_room_chat_delivery_failed` | The row was saved but Centrifugo rejected delivery (`503`, repeating the same retry key republishes it). |

A rise in `audio_room_chat_delivery_failed` with no persistence failures points at Centrifugo, while `audio_room_chat_persistence_failed` points at the database.

## Local development seed data

`npm run seed` in `backend/` gives each seeded room a short host and partner conversation and records both as participants, so the overlay renders history straight away. The rows come from `src/database/data/audio-room-chat.ts`, whose spec keeps them in step with the migration.

## Retention, rollout and rollback

Messages remain until their room or sender account is deleted, using foreign-key cascade cleanup. The migration is additive and safe with older application versions. Deploy the migration before the API and frontend.

To roll back, first disable the composer or deploy a read-only client, then stop the API writer. Do not restore direct browser publication. The additive table may remain safely. If its stored history is intentionally discarded, operators can drop `public.audio_room_messages` after confirming no deployed reader or writer uses it.
