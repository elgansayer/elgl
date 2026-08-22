# Swipe-to-reply gesture

## Contract

Chat messages already support threaded replies through the existing `reply_to_id` API contract. The context menu remains the keyboard and assistive-technology path for starting a reply. On touch devices, the long-press message wrapper also recognises a deliberate horizontal swipe and emits the same reply action.

The gesture is intentionally direction-neutral. A sufficiently horizontal swipe in either direction works in both left-to-right and right-to-left layouts. Vertical movement is treated as scrolling and cancels gesture recognition. Short horizontal movement does not start a reply.

## Interaction boundaries

- A reply requires at least 56 CSS pixels of horizontal movement.
- Vertical travel must remain within 48 CSS pixels and below the horizontal distance.
- Any meaningful movement cancels the long-press timer so a swipe cannot accidentally open the context menu.
- A recognised swipe prevents the synthetic click that mobile browsers can dispatch after touch completion.
- Touch cancellation clears all gesture state.
- Mouse behaviour is unchanged: desktop users keep the context menu and its keyboard-accessible Reply action.

No message content, user identifiers, or gesture telemetry are logged. The feature introduces no API, schema, persistence, authentication, or authorisation changes.

## Verification

The focused component tests cover rightward and leftward swipes, the movement threshold, vertical-scroll rejection, long-press cancellation, and touch cancellation. The existing chat-room tests continue to verify that a reply sets `reply_to_id`, preserves the reply preview, and clears the reply state after a successful send.

## Rollback

Revert the swipe gesture handling and its focused tests. The existing long-press/context-menu Reply action and the persisted `reply_to_id` contract remain fully functional, so rollback does not require data migration or cleanup.
