# Sent message editing

Issue #1711 restores and locks the authenticated API boundary for editing a sent text message. The persistence and realtime policy already lives in `ChatService.editMessage`; this change exposes that policy through a dedicated controller so later growth of the legacy `ChatController` cannot silently remove the route again.

## API contract

`PATCH /api/chat/messages/:messageId`

Request body:

```json
{
  "text_content": "Updated message text"
}
```

The request requires a valid Supabase session. `text_content` must contain at least one non-whitespace character and is capped at 10,000 characters, matching the normal text-message send limit. The legacy optional `reply_to_id` field remains accepted for mixed-version compatibility but editing never changes message threading.

The authoritative service permits an edit only when all of the following remain true at mutation time:

- the message exists;
- the authenticated user is the original sender;
- the message is a text message;
- the configured edit window has not elapsed (`MESSAGE_EDIT_WINDOW_MINUTES`, five minutes by default); and
- the sender is still a member of the room.

A successful edit persists the new text, sets `is_edited = true`, records `edited_at`, and publishes the updated canonical message on the room's existing Centrifugo channel. Receivers therefore converge through the same realtime path used by other message updates.

## Failure and abuse handling

- Missing authentication fails closed before the service is called.
- The endpoint is limited to 20 edit attempts per minute per NestJS throttling policy.
- Blank and oversized bodies are rejected by the normal validation pipeline before persistence.
- Ownership, message type, membership and edit-window decisions remain server-authoritative; clients cannot extend the window or edit another sender's content.
- Persistence failures do not fabricate a successful edited message.
- The endpoint does not log message text, tokens, credentials or other private chat content.

Editing is intentionally not an offline mutation: a client that cannot reach the backend must retain its local edit draft and retry while the server-side time window is still valid. The backend never extends the edit deadline because a client was offline.

## Data, privacy and retention

No new table, index or retention policy is introduced. `is_edited` and `edited_at` are existing `chat_messages` fields and remain subject to the same room membership, deletion and retention rules as the original message. Edits replace the canonical text; this feature does not create a separate edit-history store.

## Verification

Focused backend coverage verifies:

- authenticated requests reach `ChatService.editMessage` with the authenticated user id;
- unauthenticated invocation fails closed;
- ownership/edit-window failures are preserved rather than converted to success;
- non-blank text within the send-message limit validates; and
- blank, overlong text and oversized legacy compatibility fields are rejected.

The existing `ChatService` regression suite continues to cover successful persistence and Centrifugo publication, missing messages, wrong senders, non-text messages, expired edit windows and removed room members.

Recommended local commands:

```bash
cd backend
npm test -- chat-edit.controller.spec.ts dto/edit-message.dto.spec.ts chat.service.spec.ts
npm run lint:check
npm run build
```

## Rollout and rollback

This is an additive HTTP route over an existing service/schema contract and requires no migration. It is safe for mixed frontend/backend versions: older clients simply do not call the endpoint, while newer clients receive normal authorization/validation failures from older deployments that do not expose it.

Roll out the backend normally, verify an authenticated edit within the configured window and verify the Centrifugo update in a second client. Rollback is a normal application revert; no persisted data needs to be transformed or restored.
