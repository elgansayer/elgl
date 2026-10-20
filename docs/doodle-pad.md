# Doodle pad

Issue: #967

## Product contract

`DoodlePadComponent` is a chat-owned drawing editor. It renders a 600 × 400 PNG raster, exposes a fixed colour and brush-width palette, and emits the completed PNG as a `data:image/png;base64,...` URL through `doodleSaved`. It never performs a network request itself. `ChatRoomComponent` remains responsible for sending the emitted value as a `doodle` chat message and for closing the editor.

Cancelling emits `cancelled` without producing a message. Clearing resets only the raster and does not close the editor.

## Input and responsive behaviour

The drawing surface uses Pointer Events so mouse, pen, and touch share one state machine. Only the primary pointer and the primary mouse button can begin a stroke. Pointer capture is requested for an active stroke and is released when drawing finishes. `pointerup`, `pointercancel`, and leaving the drawing surface all terminate the local stroke state so an interrupted gesture cannot leave the editor stuck in drawing mode.

The backing raster is always 600 × 400. CSS may scale the canvas for narrow screens or zoom. Pointer coordinates are converted from the rendered rectangle back into raster coordinates before drawing, preserving output resolution at responsive sizes.

## Safety and privacy

The component accepts only colours and brush widths from its configured palettes. Save output is emitted only when browser serialization returns a PNG data URL. The component does not log or persist drawing contents and does not add user identifiers or other metadata to the raster.

Authorization, room membership, block/privacy rules, message size limits, persistence, and real-time fan-out remain server/chat-service responsibilities. A doodle is subject to the same authenticated message-send boundary as other chat message types.

## Accessibility

The canvas has an accessible translated name and description reference. Colour and brush-width choices remain mutually exclusive Spartan radio groups, with translated group-derived accessible labels. Clear, cancel, close, and send controls are native/Spartan-backed keyboard-operable actions. Control rows wrap rather than requiring horizontal scrolling at narrow widths and high zoom.

Freehand drawing itself is a pointer interaction; this component does not claim a keyboard drawing equivalent. The surrounding controls remain available to keyboard and assistive-technology users.

## Failure behaviour

If a pointer gesture is interrupted, the active stroke is closed and discarded from the input state while already-rendered pixels remain on the canvas. Pointer-capture failures are treated as recoverable browser-state races and do not prevent drawing.

If canvas serialization returns a value that is not a PNG data URL, the component fails closed and does not emit `doodleSaved`. Network/send failures happen after this component emits and are handled by the chat host.

## Verification

Focused regression coverage lives in `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts` and covers:

- canvas initialization and responsive coordinate scaling;
- pointer start, move, cancellation, capture, and mismatched-pointer isolation;
- configured colour/brush validation;
- template pointer-event wiring;
- clear/cancel stroke cleanup;
- accessible canvas and close-control metadata;
- exactly-once PNG emission and rejection of unexpected serialization formats.

The repository frontend CI remains the authoritative full validation gate (`lint`, template/control-flow checks, build, and Vitest suite).

## Rollout and rollback

No schema, API, environment, dependency, or persisted-data migration is required. The change is frontend-only and backward compatible with the existing `doodleSaved`/`cancelled` outputs and chat `doodle` message contract.

Rollback is a normal application revert. Existing doodle messages remain readable because their persisted message shape is unchanged.
