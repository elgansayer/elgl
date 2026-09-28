# Chat room realtime lifecycle

This document records the production contract for the Angular `ChatRoomComponent` covered by issue #965.

## Existing architecture

`ChatRoomComponent` is the canonical routed 1-on-1/group conversation surface. It reuses the authenticated `ChatService`, the shared `CentrifugeService`, and `TypingService` instead of introducing a second transport.

- Initial history is loaded from `GET /chat/messages/:roomId` and is bounded by the backend to 100 rows.
- New/edited messages and delivery-status changes arrive on `chat:<roomId>`.
- Typing presence is ephemeral and uses `chat:<roomId>:typing`; `TypingService` throttles local publications and expires remote typers after three seconds.
- The backend remains authoritative for room membership, message persistence, block policy, and delivery-status mutation.

## Realtime state transitions

The room treats Centrifugo payloads as untrusted input. `chat-room-realtime.ts` validates the minimum message identity fields and only accepts the known `sent`, `delivered`, and `read` receipt states.

1. A persisted message is returned by `POST /chat/messages` with `delivery_status = sent`.
2. A `message` event for the current room is merged by message ID. This prevents the same message being rendered twice when the sender receives both the HTTP response and the realtime echo, and also lets authoritative edit payloads replace stale local fields.
3. When an authenticated recipient loads history or receives a new message from another user, the client best-effort calls `PATCH /chat/messages/:messageId/status` with `read`.
4. The backend verifies room membership, only upgrades status, persists it, and publishes `status_update` on `chat:<roomId>`.
5. The sender applies that status update to the existing message, so the already-rendered receipt changes without a history refresh.
6. Authoritative `message_deleted` / `deleted_for=everyone` events remove the message from the open room.

Read acknowledgement is idempotent. The frontend keeps an in-flight message-ID set so reconnect/history and realtime delivery cannot create a local request storm for the same message. Failures do not hide or fabricate messages; a later reload/realtime event can retry the acknowledgement.

## Failure and degraded behaviour

- History failure leaves the component in its existing unavailable/empty flow and does not fabricate new receipt state.
- Centrifugo disconnect does not discard persisted history. Reconnect remains owned by `CentrifugeService`.
- Malformed, wrong-room, unknown-status, and unrelated realtime payloads are ignored.
- A failed read acknowledgement is non-blocking. Message reading remains usable and the persisted server state is retried naturally on a later room load/event.
- Typing failures are intentionally non-critical and never gate message sending.
- Duplicate message events are merged by ID instead of producing duplicate bubbles.

## Security and privacy

The browser never chooses the authenticated user ID for receipt mutation. `SupabaseAuthGuard` and `CurrentUser` establish the server identity, and the chat service verifies room membership before updating a message status. The UI only acknowledges messages whose `sender_id` differs from the current user. Realtime payload validation prevents arbitrary status strings or cross-room messages from mutating the current room state.

No message body, token, Centrifugo credential, or receipt payload is added to logs by this change. Typing state remains ephemeral and is not persisted.

## Accessibility and UX

The existing Chat Room UI uses semantic buttons/Spartan controls and text-backed delivery status labels. Receipt meaning is not communicated only by colour: sent is a single check and delivered/read use double checks with translated accessible labels. The existing `TypingIndicatorComponent` provides the shared typing presentation rather than adding a second visual indicator.

The room remains responsive/high-zoom compatible because no new fixed-width receipt or typing surface is introduced.

## Verification

`chat-room-realtime.spec.ts` covers:

- new-message insertion and read acknowledgement intent;
- duplicate/edit merge behaviour;
- own-message and cross-room isolation;
- valid and invalid receipt updates;
- delete-for-everyone events;
- malformed payload rejection.

The normal frontend Vitest/static-analysis/build jobs exercise the integration with the typed `ChatMessage` contract. Repository CI is authoritative for full validation.

## Rollout and rollback

There is no schema migration, new endpoint, configuration key, dependency, or persisted client state. Frontend and backend contracts already exist, so the frontend can roll out independently.

Rollback is a normal revert of the frontend integration/helper/tests/docs. Persisted messages and delivery statuses require no cleanup. During rollback, the previous UI still loads messages and renders receipt values returned by history, but live receipt changes may again require a refresh.
