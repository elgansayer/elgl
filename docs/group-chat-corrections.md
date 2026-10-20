# Group chat correction contract

Issues #845 and #1305 are implemented by the existing shared chat correction pipeline. Group conversations do not use a second correction store or a group-only transport: corrections remain ordinary authenticated chat messages in the same room, so the established membership, safety, realtime, persistence and rendering boundaries continue to apply.

## Product behaviour

A text message in a group conversation can be corrected by another participant through the existing correction action. `ChatRoomComponent.startCorrection()` copies the selected message text into the correction composer so the member can propose a replacement and optional explanation without mutating the learner's original message.

The submitted message uses `message_type = 'correction'` and stores the immutable source snapshot in `correction_payload.original`, the replacement in `correction_payload.corrected`, and the optional teaching note in `correction_payload.explanation`. `VisualDiffComponent` renders the difference while the normal chat-bubble metadata identifies the member who supplied the correction.

The current Angular chat room exposes both **Correct** and **Request correction** from the shared long-press/context-menu path. A request is posted as a `correction_request` reply to the selected message. A submitted correction uses the same room message pipeline as other chat content, so it appears to all current room participants through the established Centrifugo `chat:{roomId}` channel.

The backend also exposes `POST /chat/messages/:messageId/correct` for clients that need an explicitly threaded correction. That endpoint resolves the source message server-side, derives its room and original text from persisted data, and creates the correction with `reply_to_id` set to the source message.

Only text messages are eligible for the source-linked correction endpoint. Voice, sticker, doodle and other message types are rejected rather than coercing captions or media metadata into editable text.

## API and authorization

Chat endpoints are protected by the controller-level `SupabaseAuthGuard`. The source-linked correction endpoint cannot choose a different room because the service derives the room from the persisted source message. Both the source-linked endpoint and the Angular room composer ultimately use `ChatService.sendMessage`, retaining the existing room membership, safety, spam, persistence, realtime and notification behaviour.

No new credential, token, schema or browser-to-database boundary is introduced by this feature.

## Failure behaviour

- Missing source messages fail instead of creating detached source-linked corrections.
- Non-text source messages are rejected by the source-linked backend boundary.
- Database or message-send failures propagate through the existing chat error path; no successful correction is fabricated.
- In Angular, a failed correction send keeps the original text, proposed correction and explanation in the open composer so the member can retry.
- An omitted explanation remains optional so existing correction-enrichment behaviour remains compatible.

## Realtime behaviour

All room participants subscribe to `chat:<room-id>`. Incoming corrections therefore pass through `applyChatRoomRealtimeEvent()` like other chat messages. The client validates the untrusted payload, rejects messages for another room, merges replayed message IDs rather than duplicating bubbles, and schedules the normal read acknowledgement for an incoming correction.

This keeps group corrections compatible with reconnect/replay behaviour and with mixed client versions that already understand the established `correction` message type.

## Security and privacy

- Clients do not publish directly to Centrifugo as an authority; persisted server messages remain canonical.
- Correction text is private conversation content and must not be copied into analytics or diagnostic logs.
- Block, membership and room-access rules remain those of the containing conversation; there is no parallel group-correction participant model.
- Realtime events are treated as untrusted and must pass the existing room/message validation before mutating local state.

## Accessibility

The correction flow reuses the existing keyboard-accessible message context menu and correction form. Visual differences use semantic insertion/deletion markup and text, not colour alone. The form remains usable at high zoom and does not discard entered content after retryable failures.

## Regression coverage

`backend/src/chat/group-chat-corrections.spec.ts` locks the source-linked backend contract:

- correction stays in the source room;
- `reply_to_id` points to the original group message;
- original and corrected text are preserved separately;
- the correcting participant remains the sender of the new message;
- an optional explanation is preserved; and
- non-text and missing source messages fail before a correction is sent.

`frontend/src/app/components/chat-room/chat-room.group-corrections.spec.ts` closes the frontend/realtime verification gap for #1305:

- a three-person group member can open the correction composer from another member's text;
- the selected original sentence is preserved in the composer;
- corrected text and explanation are sent to the same group room;
- a persisted correction is appended and the form clears only after success;
- a failed send keeps the complete correction draft available for retry;
- another member's correction arrives through the realtime reducer;
- replay of the same realtime correction does not duplicate the bubble; and
- corrections from a different room are ignored.

The wider chat suites continue to cover message persistence, Centrifugo publication, blocking, message filters and correction payload enrichment.

## Verification

Run the focused frontend and backend Vitest suites, then the normal frontend/backend lint, unit and build gates. GitHub Actions remains authoritative for the full repository verification and independent-review policy.

## Rollout and rollback

No migration, API version, route, configuration or persisted-data migration is required. This completion change adds frontend/realtime regression coverage and expands documentation around the already-deployed correction path. Rollback is a normal revert of this PR and has no database or client-state rollback requirement.
