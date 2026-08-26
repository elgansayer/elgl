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

Typing events contain only the authenticated user ID, display name, avatar URL, boolean typing state, and client timestamp. Anonymous clients do not publish typing presence.

A `typing=true` event is throttled to protect the realtime channel. A `typing=false` event is never throttled and resets the throttle window so a user who stops and immediately resumes typing is announced promptly.

No message text, draft content, access token, email address, or other private content is included in the typing payload.

## Receiving and failure handling

Incoming payloads are treated as untrusted data. The client requires:

- a non-empty string `userId`;
- a finite numeric `timestamp`;
- a boolean `typing` value.

Malformed payloads are ignored. A valid remote typer expires after three seconds without another update. Explicit stop events remove that user immediately.

This feature is best effort by design. It must not block message composition, message delivery, navigation, or room teardown when Centrifugo is unavailable.

## Online status

Typing and online status have different semantics:

- typing means a valid recent typing event was observed for the active room;
- online status comes from the authoritative room/profile response and is subject to the user's visibility/privacy policy.

The client must not infer `is_online=true` from a typing event or keep a user online after typing expires.

## Verification

Regression coverage lives in `frontend/src/app/services/typing.service.spec.ts` and verifies:

- authenticated publication and anonymous suppression;
- throttled starts, immediate stops, and immediate restart after stop;
- valid remote typing state and timeout expiry;
- malformed/self-event rejection;
- explicit stop handling;
- disconnect-before-connect race safety;
- rapid room-switch race safety.

The normal frontend unit, static-analysis, and production-build gates remain authoritative for integration validation.

## Rollout and rollback

This is a frontend-only lifecycle hardening change. It adds no database migration, API change, or persisted state. Rollback is a normal frontend code revert. A rollback must not reintroduce anonymous typing publication or allow a stale asynchronous room connection to overwrite the current room subscription.
