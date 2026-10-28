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

## Publishing

Clients never publish typing events to Centrifugo. The Centrifugo `chat` namespace rejects client publications, so a client cannot claim to be someone else or type in a room it does not belong to. Instead `TypingService.sendTyping` calls `POST /chat/typing` with `{ room_id, is_typing }`, where `room_id` is a UUID and `is_typing` is a boolean.

The API:

1. takes the user from the authenticated session, never from the body;
2. verifies the caller is a member of the room (404 for an unknown room, 403 for a non-member);
3. publishes `{ userId, typing, timestamp }` to `chat:<roomId>:typing`.

The endpoint is rate limited (60 requests per minute per user). A failed request is ignored by the client because typing is best effort.

A `typing=true` event is throttled on the client to one request every two seconds. A `typing=false` event is never throttled and resets the throttle window so a user who stops and immediately resumes typing is announced promptly. Anonymous clients and clients that have not joined a room send nothing.

No message text, draft content, access token, email address, display name, avatar or other private content is included in the typing payload.

## Receiving and failure handling

The payload is identified by the server, but incoming data is still treated as untrusted. The client requires:

- a finite numeric `timestamp`;
- a boolean `typing` value;
- an identity: the server-verified publisher when Centrifugo supplies one, otherwise the payload `userId`. If both exist and disagree the event is dropped as an impersonation attempt.

Malformed payloads are ignored. A valid remote typer expires after three seconds without another update. Explicit stop events remove that user immediately. At most 20 typers are tracked so a flooded channel cannot grow memory without bound.

Any name in a payload is only a hint: control characters and bidirectional overrides are removed and the length is capped at 60 characters. A payload avatar is never used.

`ChatRoomComponent` resolves each typist against the room's participant roster and uses the roster's display name and avatar. When the person is not on the roster (or has no name) the indicator shows the translated "Someone", and an initial instead of an image.

This feature is best effort by design. It must not block message composition, message delivery, navigation, or room teardown when Centrifugo is unavailable.

## Presentation and accessibility

`TypingIndicatorComponent` shows overlapping avatars (up to three, then a `+N` badge), animated dots and one translated sentence built with `Intl.ListFormat` for the UI language. The same sentence is the accessible name of a polite `role="status"` region, and the dots and avatars are hidden from assistive technology, so the meaning never depends on the animation. The animation stops under `prefers-reduced-motion`, spacing uses logical properties for RTL, and the colours are Relay semantic roles that work in light and dark themes.

## Online status

Typing and online status have different semantics:

- typing means a valid recent typing event was observed for the active room;
- online status comes from the authoritative room/profile response and is subject to the user's visibility/privacy policy.

The client must not infer `is_online=true` from a typing event or keep a user online after typing expires.

## Verification

Backend: `chat.controller.spec.ts` and `chat.service.spec.ts` cover the `POST /chat/typing` route, authentication, the membership check and the published payload; `SendTypingDto` accepts a UUID and a boolean (also the strings `"true"` and `"false"` from older clients).

Frontend: `typing.service.spec.ts` verifies:

- typing is requested through the API and never published by the client;
- anonymous suppression and no requests outside a room;
- throttled starts, immediate stops, and immediate restart after stop;
- valid remote typing state and timeout expiry;
- server-verified publisher precedence and impersonation rejection;
- name sanitisation, the ignored payload avatar, and the bound on tracked typers;
- malformed/self-event rejection and explicit stop handling;
- disconnect-before-connect and rapid room-switch race safety.

`typing-indicator.component.spec.ts` covers the sentence variants, initials, overflow badge and accessibility, and `chat-room.stream.spec.ts` covers roster names and avatars inside the room.

The normal frontend unit, static-analysis, and production-build gates remain authoritative for integration validation.

## Rollout and rollback

There is no database migration. Deploy the backend (which adds `POST /chat/typing`) before the frontend that calls it, and apply the Centrifugo `chat` namespace change last, as described in `docs/centrifugo-server-config.md`. Rollback is a normal code revert. A rollback must not reintroduce anonymous typing publication or client-side publication to the `chat` namespace, and must not allow a stale asynchronous room connection to overwrite the current room subscription.
