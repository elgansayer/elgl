# Incoming call lifecycle

This document describes the production contract for the Angular incoming-call surface tracked by issue #1742.

## Scope

`IncomingCallComponent` owns the authenticated realtime invitation lifecycle for direct LiveKit calls. It subscribes only to the signed-in user's Centrifugo channel, validates incoming invitation payloads, presents ringtone-backed accept/reject controls, joins LiveKit on acceptance, and emits local accepted/rejected events for the rest of the client.

The component does not persist call invitations or introduce a new server-side call state model. Existing Centrifugo and LiveKit services remain the transport and media boundaries.

## Realtime trust boundary

Centrifugo publications are treated as untrusted input even though the connection itself is authenticated. An `incoming_call` event is accepted only when:

- `callInfo` is an object;
- `callerId` and `roomName` are bounded channel-safe tokens;
- `callerName` is non-empty, bounded to 100 characters, and contains no control characters;
- `isVideo` is a real boolean;
- an optional avatar is an absolute HTTP(S) URL without embedded credentials and is at most 2,048 characters; and
- an optional E2EE key is non-empty and bounded.

Malformed events are ignored before they can mutate UI state, join a media room, or influence a publish-channel name. Private call metadata, tokens, provider errors, and E2EE material are not logged.

Only one invitation may own the modal at a time. Duplicate or overlapping realtime deliveries cannot replace the call that the user is already deciding on.

## User-visible state transitions

### Incoming

1. A valid invitation becomes the active call and opens the modal.
2. The current call-silencing preference is refreshed.
3. When that preference is available and permits ringing, the bundled ringtone loops.
4. If browser autoplay is unavailable, the component attempts the existing Web Audio fallback.
5. If the privacy preference itself cannot be loaded, the modal stays available but the client fails silent instead of unexpectedly producing audio.

Ringtone fallback callbacks are generation-scoped. A delayed autoplay rejection cannot start fallback audio after the call has been accepted, rejected, replaced by logout cleanup, or destroyed.

### Accept

Accepting a call is serialized. While a LiveKit join is in flight, accept/reject controls are disabled and duplicate accept attempts are ignored.

The LiveKit participant identity must come from the current authenticated session. The client never substitutes a synthetic `unknown` identity. If authentication has disappeared, the join fails closed.

On a successful join:

1. the modal closes;
2. the active invitation is cleared;
3. the caller receives the existing `call_accepted` Centrifugo signal;
4. success haptics run; and
5. the component emits `callAccepted`.

If LiveKit joining fails, the invitation is retained and the modal remains available for retry. The caller is not told that the call was accepted, and error haptics provide local failure feedback.

### Reject

Reject is idempotent from the component's perspective. It stops ringtone output, closes and clears the active call, publishes the existing `call_rejected` signal when an authenticated identity is still available, and emits `callRejected` once. Repeated clicks cannot duplicate the signal.

### Logout / teardown

Session loss and component destruction stop all ringtone output, clear pending UI state, discard the active invitation, and unsubscribe from the user-specific Centrifugo channel.

## Accessibility and responsive behavior

The incoming surface exposes modal dialog semantics and `aria-busy` while a call action is in flight. Icon-only accept and decline controls include localized screen-reader text, decorative icons are hidden from assistive technology, caller names use `dir="auto"`, and the ringing state is announced politely. Existing 56–64 px circular controls remain above the 44 px touch-target baseline.

Motion is disabled when `prefers-reduced-motion: reduce` is active. The existing narrow-screen gutters and responsive sizing are retained for mobile/high-zoom layouts.

## Failure handling

| Failure | Behavior |
| --- | --- |
| malformed realtime event | ignore it without changing active call state |
| profile/privacy lookup unavailable | show controls but remain silent |
| ringtone file/autoplay failure | try bounded Web Audio fallback while the call is still active |
| all programmatic audio unavailable | keep visual accept/reject controls usable |
| authentication disappears before accept | do not join or publish acceptance |
| LiveKit join fails | retain modal and invitation for retry |
| duplicate accept/reject input | serialize/suppress duplicate mutation |
| logout/destroy | stop audio and clear state |

No database migration, retention policy, new secret, or new network endpoint is introduced.

## Verification

Focused Angular tests cover:

- subscription to the authenticated user's channel;
- valid invitation rendering and dialog semantics;
- malformed/channel-injection/unsafe-avatar rejection;
- bounded metadata normalization;
- overlapping invitation suppression;
- privacy-setting outage behavior;
- authenticated LiveKit acceptance;
- retry after a failed LiveKit join;
- duplicate in-flight acceptance suppression;
- fail-closed behavior after logout; and
- idempotent rejection signaling.

Repository CI remains authoritative for the complete frontend unit, build, lint/static-analysis, accessibility/design-governance, and E2E contracts.

## Rollout and rollback

This is a frontend-only hardening change. It preserves the existing `incoming_call`, `call_accepted`, and `call_rejected` realtime shapes and the `IncomingCallInfo` output contract, so it can roll out independently of backend deployments.

Rollback is a normal code revert. No persisted data or schema needs to be reverted. During mixed-version rollout, older clients continue to consume the same realtime contract while newer clients apply stricter input validation and retry-safe state handling.
