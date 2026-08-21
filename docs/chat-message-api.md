# Chat message API contract

Issue: #964

## Endpoint

`POST /api/chat/messages` is the authenticated write boundary for user-authored chat messages. `ChatController` is protected by `SupabaseAuthGuard`, and the caller identity comes from the validated Supabase session rather than from the request body.

The endpoint persists the message through `ChatService` to `chat_messages` and then publishes the saved representation to the Centrifugo channel `chat:<room_id>`. The database row is the source of truth. Realtime delivery is an acceleration path, not a second store.

## Request validation

`SendMessageDto` is processed by the application's global `ValidationPipe` with unknown fields rejected. The request contract is intentionally bounded before any database or realtime work begins.

| Field | Contract |
| --- | --- |
| `room_id` | Required non-empty string, at most 128 characters. |
| `message_type` | One of `text`, `voice`, `correction`, `doodle`, `sticker`, `correction_request`, `status_reply`, or `view_once_media`. System and gift messages are server-owned flows and are not accepted here. |
| `text_content` | Required and non-blank for `text`; at most 10,000 characters whenever supplied. |
| `media_url` | Required and non-blank for `voice`, `doodle`, `sticker`, and `view_once_media`; at most 3,000,000 characters. The large bound intentionally preserves the existing doodle flow, which sends a PNG data URL. |
| `correction_payload` | Required for `correction`. `original` and `corrected` must be non-blank strings of at most 10,000 characters; optional `explanation` is capped at 20,000 characters. |
| `correction_request_payload` | Required for `correction_request`. `original_text` must be non-blank and at most 10,000 characters; optional `target_language` is capped at 64 characters. |
| `status_reply_payload` | Required for `status_reply`. `status_update_id` is capped at 128 characters and `status_text` must be non-blank and at most 1,000 characters. |
| `reply_to_id` | Optional non-empty string, at most 128 characters. |

Nested payloads use `class-transformer` plus `@ValidateNested`, so malformed nested objects are rejected by the same global validation boundary rather than reaching `ChatService` as unchecked records.

## Persistence and realtime behavior

On the accepted path, `ChatService.sendMessage` performs the existing safety/message-filter and spam checks, inserts the row into `chat_messages`, enriches supported messages, and calls `CentrifugoService.publish()` with the saved message. Notifications, mentions, XP, away replies, and receipt handling remain downstream of the persisted message.

A database insert failure aborts the request before Centrifugo publication. Centrifugo publication itself currently returns a boolean and logs sanitized transport failures; it is deliberately best-effort so an already-persisted message is not deleted merely because realtime transport is temporarily unavailable. Clients recover authoritative state from message history after reconnecting. This PR does not attempt a distributed transaction between Postgres and Centrifugo.

## Security and privacy

- Sender identity is server-derived from the authenticated Supabase user.
- The request body cannot select a different `sender_id` because that field is not part of the DTO and non-whitelisted fields are rejected.
- The existing block, first-message privacy-filter, and spam checks continue to run before persistence.
- Centrifugo API credentials remain server-side. `CentrifugoService` logs the channel and sanitized error message on transport failure, not request authorization headers or message content.
- No new persisted fields or retention category are introduced. Message deletion/retention behavior remains the existing `chat_messages` policy.

## Failure semantics

- Invalid or oversized request data: rejected by Nest validation before the service mutation runs.
- Missing/invalid authentication: rejected by `SupabaseAuthGuard`.
- Privacy filter, block, or spam rejection: no message row is created and nothing is published.
- Supabase insert failure: request fails and nothing is published.
- Centrifugo transport failure after persistence: the row remains authoritative and is recoverable through history/reconnect; the realtime transport failure is logged without message content.

## Verification

The DTO regression suite covers the valid text path, required per-message-type fields, nested payload validation, unsupported message types, whitespace-only content, data-URL compatibility, and size limits. Existing `ChatService` tests cover persistence to `chat_messages`, failed inserts, and publication to the `chat:<room_id>` Centrifugo channel.

Before deployment, the backend verification gate should pass (`npm run lint`, `npm test`, and `npm run build` from `backend/`).

## Rollout and rollback

There is no database migration and no response-shape change. Deploy the backend normally. Clients that previously sent structurally invalid messages will begin receiving validation errors and should correct their payload rather than relying on partially populated rows.

Rollback is a normal application revert of the DTO validation changes. Persisted messages require no data rollback, and Centrifugo or Supabase configuration is unchanged.
