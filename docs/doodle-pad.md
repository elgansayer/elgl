# Doodle pad

Issues: #967 (component), #1811 (send state)

## Product contract

`DoodlePadComponent` is a chat-owned drawing editor. It renders a 600 × 400 PNG raster, exposes a fixed colour and brush-width palette, and emits the completed PNG as a `data:image/png;base64,...` URL through `doodleSaved`. It never performs a network request itself. `ChatRoomComponent` remains responsible for sending the emitted value as a `doodle` chat message and for closing the editor.

Cancelling emits `cancelled` without producing a message. Clearing resets only the raster and does not close the editor.

## Send state owned by the host

The pad does not know how a doodle is delivered, but it renders the host's delivery state through two optional inputs, so the learner never loses a drawing silently:

- `busy` (default `false`): a send is in flight. The send and clear controls are disabled, the send label becomes **Sending doodle...**, a polite `role="status"` region announces it, and pointer drawing, `clearCanvas()` and `save()` are ignored so the raster cannot change underneath an upload or emit a second doodle. Cancel stays enabled so a stalled request cannot trap the learner.
- `errorKey` (default `null`): a translation key for the failure of the last attempt, shown in a `role="alert"` region. The editor remains fully usable, so the learner can retry or keep drawing. The host supplies a key rather than text so the message follows the interface language.

How the doodle is uploaded and sent, and the retry, idempotency and room-change rules, are in `docs/doodle-message-sharing.md`.

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

If canvas serialization returns a value that is not a PNG data URL, the component fails closed and does not emit `doodleSaved`. Upload and send failures happen after this component emits and are handled by the chat host, which reports them through `errorKey` while keeping the pad open and the drawing intact.

## Verification

Focused regression coverage lives in `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts` and covers:

- canvas initialization and responsive coordinate scaling;
- pointer start, move, cancellation, capture, and mismatched-pointer isolation;
- configured colour/brush validation;
- template pointer-event wiring;
- clear/cancel stroke cleanup;
- accessible canvas and close-control metadata;
- exactly-once PNG emission and rejection of unexpected serialization formats;
- idle, sending and failed rendering, disabled controls while busy, a frozen raster while busy, cancel staying available, and drawing resuming when the host is idle again.

The repository frontend CI remains the authoritative full validation gate (`lint`, template/control-flow checks, build, and Vitest suite).

## Rollout and rollback

No schema, API, environment, dependency, or persisted-data migration is required for the component. The `busy` and `errorKey` inputs are optional with inert defaults, so existing hosts and the `doodleSaved`/`cancelled` outputs are unchanged.

Rollback is a normal application revert. Existing doodle messages remain readable because their persisted message shape is unchanged.
