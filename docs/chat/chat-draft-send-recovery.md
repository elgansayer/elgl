# Chat failed-send draft recovery

## Scope

Issue #1425 requires text entered in `ChatRoomComponent` to remain recoverable when message delivery fails. The current send path keeps the composer and persisted draft intact until `ChatService.sendMessage()` resolves successfully. Storage, retention and restore rules for the draft itself are in [draft-persistence.md](../draft-persistence.md).

## Contract

For text messages:

1. Composer text is normalised into the outbound payload, but the visible `textInput` is not cleared before delivery completes.
2. The room's draft record is not deleted while a send is in flight, and a second submit is ignored until the pending request settles, so the retained text cannot be sent twice.
3. If delivery fails (for example because the browser is offline, the API rejects the request, or moderation refuses the message), the composer retains the user's original text and the normalised text is saved into the room's draft record for reload recovery. Only the text is updated: a stored reply target is kept.
4. A successful `sendMessage()` result clears the composer, reply preview and the room's draft record, including any raw-text copy left by an older version, only when they still contain the submitted message. A newer composition written while delivery is pending remains visible and stored.
5. Grammar-check suggestions remain a pre-send review step and do not count as successful delivery.
6. The room is captured when the send starts. If the learner opens another room while the request is pending, the result only clears or saves the draft of the room the message was written in, and never changes the new room's composer or message list.

This is intentionally client-side recovery only. It does not report a message as sent, fabricate an optimistic server identifier, or bypass backend moderation/authorization.

## Privacy and retention

Chat drafts remain subject to the `DraftService` contract: storage is scoped by authenticated user and room, bounded in size, best-effort when browser storage is unavailable, and removed 30 days after the last save. This change does not introduce server-side draft persistence.

## Failure behaviour

A send failure must never clear a draft as a side effect. Browser storage failures are tolerated: the text remains in the in-memory composer even if `localStorage` cannot be written. Retrying uses the normal authenticated `ChatService.sendMessage()` path.

## Verification

Run the focused regression suites:

```bash
cd frontend
npx ng test --no-watch \
  --include src/app/components/chat-room/chat-room.draft-recovery.spec.ts \
  --include src/app/components/chat-room/chat-room.draft-restore.spec.ts
node --test ../scripts/chat-send-draft-contract.test.mjs
```

The suites verify that draft deletion does not occur while a request is pending, that a second submit is ignored, that failed sends preserve the composer and persist recovery text with the reply target, that successful sends clear the draft, and that a send finishing after a room change leaves the new room untouched.

## Rollout and rollback

No schema, API, or migration change is required. Rollback is code-only; existing local drafts remain readable by the previous release.
