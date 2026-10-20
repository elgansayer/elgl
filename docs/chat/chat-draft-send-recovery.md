# Chat failed-send draft recovery

## Scope

Issue #1425 requires text entered in `ChatRoomComponent` to remain recoverable when message delivery fails. The current send path keeps the composer and persisted draft intact until `ChatService.sendMessage()` resolves successfully.

## Contract

For text messages:

1. Composer text is normalized into the outbound payload, but the visible `textInput` is not cleared before delivery completes.
2. Existing per-room draft records are not deleted while a send is in flight.
3. If delivery fails (for example because the browser is offline, the API rejects the request, or moderation refuses the message), the composer retains the user's original text and the normalized text is persisted through the legacy text-draft key for reload recovery.
4. Only a successful `sendMessage()` result clears the composer, reply preview, legacy draft, and enriched v2 draft.
5. Grammar-check suggestions remain a pre-send review step and do not count as successful delivery.

This is intentionally client-side recovery only. It does not report a message as sent, fabricate an optimistic server identifier, or bypass backend moderation/authorization.

## Privacy and retention

Chat drafts remain subject to the existing `DraftService` contract: storage is scoped by authenticated user and room, bounded in size, and best-effort when browser storage is unavailable. This change does not introduce server-side draft persistence or new retention.

## Failure behaviour

A send failure must never clear a draft as a side effect. Browser storage failures are tolerated: the text remains in the in-memory composer even if `localStorage` cannot be written. Retrying uses the normal authenticated `ChatService.sendMessage()` path.

## Verification

Run the focused regression suite:

```bash
npm --prefix frontend test -- --run src/app/components/chat-room/chat-room.draft-recovery.spec.ts
```

The suite verifies that draft deletion does not occur while a request is pending, failed sends preserve the composer and persist recovery text, and successful sends clear both draft formats.

## Rollout and rollback

No schema, API, or migration change is required. The regression coverage can deploy with the normal frontend release. Rollback is code-only; existing local drafts remain readable because no storage format changes are introduced.
