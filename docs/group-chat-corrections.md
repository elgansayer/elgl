# Group chat correction contract

Issue #845 is implemented by the existing shared chat correction pipeline. Group conversations do not use a second correction store or a group-only transport: corrections remain ordinary authenticated chat messages in the same room, so the established membership, safety, realtime, persistence and rendering boundaries continue to apply.

## Product behaviour

A text message in a group conversation can be corrected by another participant through the existing correction action. The correction is written as a new `correction` message in the original room, keeps the original text in `correction_payload.original`, stores the proposed replacement in `correction_payload.corrected`, and sets `reply_to_id` to the source message. This preserves conversational context instead of mutating the learner's original message.

The current Angular chat room exposes both **Correct** and **Request correction** from the shared long-press/context-menu path. A request is posted as a `correction_request` reply to the selected message. A submitted correction uses the same room message pipeline as other chat content, so it appears to all current room participants through the established Centrifugo `chat:{roomId}` channel.

Only text messages are eligible for correction. Voice, sticker, doodle and other message types are rejected by the backend correction boundary rather than coercing their captions or media metadata into editable text.

## API and authorization

`POST /chat/messages/:messageId/correct` is protected by the controller-level `SupabaseAuthGuard`. The service resolves the source message server-side, derives its room and original text from persisted data, and constructs the correction message itself. Clients cannot choose a different source room through this endpoint.

The correction then goes through `ChatService.sendMessage`, which retains the existing room safety, spam, persistence, realtime and notification behaviour. No new credential, token, schema or browser-to-database boundary is introduced by this feature.

## Failure behaviour

- Missing source messages fail instead of creating detached corrections.
- Non-text source messages return a validation failure.
- Database or message-send failures propagate through the existing chat error path; no successful correction is fabricated.
- An omitted explanation remains optional so the existing correction-enrichment path can provide an explanation where configured.

## Regression coverage

`backend/src/chat/group-chat-corrections.spec.ts` locks the group correction contract:

- correction stays in the source room;
- `reply_to_id` points to the original group message;
- the original and corrected text are preserved separately;
- the correcting participant remains the sender of the new message;
- an optional explanation is preserved for existing server-side enrichment;
- non-text and missing source messages fail before a correction is sent.

The wider chat suites continue to cover message persistence, Centrifugo publication, blocking, message filters and correction payload enrichment.

## Verification

Run the focused backend test through the repository's backend Vitest configuration, then run the normal backend lint, unit and build gates. GitHub Actions remains authoritative for the full repository verification and independent-review policy.

## Rollout and rollback

No migration or configuration change is required. This completion change adds regression coverage and architecture documentation around the already-deployed correction path. Rollback is a normal revert of this test/documentation commit; reverting it does not require a database or client-state rollback.
