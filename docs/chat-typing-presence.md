# Chat typing and online presence contract

## Scope

Typing indicators are ephemeral realtime hints for the currently open chat room. They are not persisted, they are not used as an authorization signal, and they must never manufacture an authenticated identity. Online/offline status remains server-owned room/profile data (`is_online`) and is intentionally separate from typing activity.

## Realtime ownership

`TypingService` owns the `chat:<roomId>:typing` Centrifugo subscription used by `ChatRoomComponent` and `TypingIndicatorComponent`.

- Entering a room connects to its typing channel.
- Leaving or switching rooms clears local typers and invalidates any pending asynchronous connection attempt.
- Late connection callbacks from a previous room are ignored so they cannot resurrect a stale subscription.
- The authenticated user's own typing event is ignored by the receiving state reducer.
- Realtime/provider failure is non-fatal: chat history and message sending remain usable even when typing presence is unavailable.

## Publishing and authorization

The browser does not publish identity-bearing typing events directly to Centrifugo. It sends only `{ room_id, is_typing }` to authenticated `POST /api/chat/typing`.

`ChatTypingController` and `ChatTypingService` then:

1. derive the sender identity exclusively from the verified Supabase session;
2. require the sender to be a current `chat_room_members` member for that room;
3. read display name and avatar metadata server-side;
4. bound/sanitize profile metadata;
5. publish the canonical event to `chat:<roomId>:typing`.

The endpoint is throttled to 40 requests per minute per application throttle context. A failed membership lookup fails closed, a non-member receives `403`, and Centrifugo/provider failure becomes a stable `503` without exposing provider details.

On the client, a `typing=true` request is throttled to protect the API/realtime channel. A `typing=false` request is never locally throttled and resets the throttle window so a user who stops and immediately resumes typing is announced promptly.

No message text, draft content, email address, or profile metadata supplied by the browser is included in the request. The access token is used only as the normal Authorization header and is never copied into a realtime event.

## Receiving and failure handling

Incoming realtime payloads are treated as untrusted data even though the supported producer is server-owned. The client requires:

- a non-empty string `userId` no longer than 128 characters;
- a finite numeric `timestamp` no more than 10 seconds old and no more than 5 seconds in the future;
- a boolean `typing` value.

Display names are trimmed and bounded to 80 characters. Avatar URLs are limited to 2,048 characters and accept only root-relative or HTTP(S) URLs. Unsupported schemes are discarded. Group typing state is bounded to the supported 19 remote participants.

Malformed, stale, future-skewed, and self-authored payloads are ignored. A valid remote typer expires after three seconds without another update. Explicit stop events remove that user immediately.

This feature is best effort by design. It must not block message composition, message delivery, navigation, or room teardown when the API or Centrifugo is unavailable.

## Accessibility

The typing indicator uses a polite, atomic live region whose visible translated status text is also the assistive-technology announcement. It does not construct a separate hard-coded English ARIA label. Avatar thumbnails and animated dots are decorative to avoid duplicate announcements, and typing animations are disabled when `prefers-reduced-motion: reduce` is active.

## Online status

Typing and online status have different semantics:

- typing means a valid recent typing event was observed for the active room;
- online status comes from the authoritative room/profile response and is subject to the user's visibility/privacy policy.

Chat-list filtering continues to use only the server-provided `is_online` flag. An online conversation now displays both the existing success-colour dot and a localized visible **Online** label, so the state is not communicated by colour alone. The dot is decorative for assistive technology because the text already carries the meaning.

The client must not infer `is_online=true` from a typing event, Centrifugo transport connectivity, or recent message activity, and it must not keep a user online after typing expires.

## Verification

Regression coverage includes:

- `backend/src/chat/chat-typing.service.spec.ts`: membership authorization, server-owned identity, bounded metadata, provider degradation, and publish failure;
- `backend/src/chat/chat-typing.controller.spec.ts`: authenticated principal binding and unauthenticated rejection;
- `frontend/src/app/services/typing.service.spec.ts`: authenticated API publication, anonymous suppression, request minimization, throttling, remote payload validation, expiry, bounds, and room-switch races;
- `frontend/src/app/components/primitives/typing-indicator/typing-indicator.component.spec.ts`: translated live-region semantics and decorative media;
- `frontend/src/app/components/chat-list/chat-list.component.spec.ts`: authoritative online filtering and visible non-colour status text.

The normal backend/frontend unit, lint/static-analysis, and production-build gates remain authoritative for integration validation.

## Rollout and rollback

This change adds no database migration or persisted presence state. Mixed-version clients can continue receiving the same `chat:<roomId>:typing` event shape. New clients publish through `POST /api/chat/typing`; therefore deploy the backend before or with the frontend so the endpoint is available before clients switch from the legacy direct-publish path.

Rollback is a normal backend/frontend code revert. A rollback must not reintroduce client-controlled typing identities, unauthenticated publication, stale room subscriptions, or colour-only online status as the sole status representation.
