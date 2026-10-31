# Chat voice-message transcription

Issue #1790 adds durable speech-to-text state beside chat voice messages. The database row remains the source of truth. Centrifugo accelerates state changes to connected clients, and message history restores the same state after a reconnect or page reload.

## User and API contract

Authenticated room members request transcription with `POST /api/chat/messages/:messageId/transcription`. The endpoint returns HTTP `202` with the current `ChatMessage`. It is idempotent for messages already in `pending`, `processing`, `ready`, or `empty` state.

The visible states are:

- `not_requested`: the voice bubble offers **Transcribe**.
- `pending` or `processing`: the action is disabled and an accessible live status reports progress.
- `ready`: the persisted transcript is shown beside the audio controls.
- `empty`: the bubble reports that no speech was detected.
- `failed`: the bubble reports failure and offers a manual retry.
- `unavailable`: provider configuration is unavailable and the bubble offers a later retry.

Audio playback remains available in every transcription state. A transcription failure never replaces or disables the original voice note.

## Authorisation and media trust

The API derives the caller from the Supabase session and verifies current `chat_room_members` membership before queueing work. Non-voice, deleted, expired disappearing, server-encrypted, and missing-media messages are rejected. Completed transcripts do not spend another daily AI allowance.

The browser sends only the message ID. The worker reads the stored `media_url` and accepts only HTTPS URLs under the configured `CLOUDFLARE_R2_PUBLIC_URL` origin and the sender-owned `voice-notes/<sender_id>/` prefix. Query strings, fragments, credentials, off-origin URLs, encoded directory traversal sequences, subpaths, and mismatched owner prefixes are rejected before Azure receives the URL. Provider keys remain server-side, and logs never contain media URLs, transcript text, provider response bodies, tokens, or user IDs.

## Persistence and worker lifecycle

Migration `20261031110000_chat_voice_transcriptions.sql` adds transcript, status, attempt, retry, completion and sanitised error fields to `chat_messages`. It also adds a partial queue index covering only `pending` and `failed` rows. Existing application versions ignore the additive fields and continue to read and write messages normally.

`ChatVoiceTranscriptionService` queues the row and returns without holding the HTTP request open. A bounded worker immediately attempts the job, and a 30-second scheduled pass recovers missed work. Claims compare status and attempt count, so only one replica invokes the provider. Interrupted `processing` claims become retryable after 15 minutes. Provider failures use bounded exponential retry with at most four automatic attempts. Manual retries pass through the same authentication, membership, throttling and daily AI allowance checks.

Azure batch transcription is shared with audio-room archive transcription through `SpeechTranscriptionService`. Provider results are typed as ready, empty, unavailable or failed. Only a ready transcript is stored, capped at 100,000 characters. Failure rows store a fixed error code rather than provider content.

## Retention, privacy and deletion

The transcript is stored on its parent `chat_messages` row. It therefore follows existing message expiry, delete-for-everyone and account-deletion behaviour without a second retention store or orphan cleanup path. Delete-for-self prevents that member from requesting the transcript again, while the underlying row follows the existing shared-message lifecycle.

Transcripts are private message content. They must not be added to logs, metrics labels, notifications, unauthorised search results, or analytics payloads.

## Failure recovery and observability

Sanitised logs record the message identifier, final state and fixed error code so an operator can correlate an API-visible message without direct transcript access. The persisted status, attempt count, last-attempt time, next-retry time and error code distinguish provider outages, invalid stored media, interrupted workers and empty recognition.

Realtime publication is best-effort after each persisted transition. If Centrifugo is unavailable, the database state is still authoritative and the next message-history load recovers it.

## Rollout and rollback

Deploy the additive migration before or with the backend. Mixed backend and frontend versions remain safe because new fields have defaults and old clients ignore them. Verify Azure Speech configuration, the R2 public origin, the partial queue index and one non-production voice note before enabling normal traffic.

Application rollback is a normal code revert. Leave the additive columns and index in place so older and newer replicas can overlap and stored transcripts are preserved. A later separately authorised contraction may remove them only after every reader and worker has been retired. No destructive rollback is part of this change.

## Focused verification

Coverage includes the migration contract, provider result mapping, membership and message-type authorisation, idempotent queueing, concurrent worker claims, trusted-media enforcement, persisted realtime updates, the Angular API request, and accessible loading, retry, empty and completed UI states.
