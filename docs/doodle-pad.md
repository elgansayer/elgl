# Doodle pad

Issues: #967 (drawing editor), #1734 (chat modal host)

## Product contract

`DoodlePadComponent` is a chat-owned drawing editor. It renders a 600 × 400 PNG raster, exposes a fixed colour and brush-width palette, and emits the completed PNG as a `data:image/png;base64,...` URL through `doodleSaved`. It never performs a network request itself. `ChatRoomComponent` remains responsible for sending the emitted value as a `doodle` chat message and for closing the editor.

Cancelling emits `cancelled` without producing a message. Clearing resets only the raster and does not close the editor.

## Modal host

`ChatRoomComponent` hosts the pad in a Spartan Dialog (`hlm-dialog` with `*hlmDialogPortal`) instead of a hand-built fixed backdrop. The chat room keeps the product state: `showDoodleModal` opens the dialog and setting it back to `false` closes it. The pad itself is unchanged and knows nothing about the dialog, so it stays reusable and testable on its own.

- **Semantics:** the dialog is modal (`role="dialog"`, `aria-modal="true"`). It is named by the translated pad heading (`aria-labelledby="doodle-pad-title"`), so assistive technology announces the same translated copy as the visible UI. It deliberately has no separate description: the only available text (`doodle-pad-instructions`) repeats the title and is already the canvas description, and Spartan's default would otherwise point `aria-describedby` at an element that does not exist.
- **Focus:** focus moves into the dialog when it opens and returns to the Doodle trigger when it closes. CDK focus-trap anchors keep Tab and Shift+Tab inside the dialog while it is open.
- **Dismissal:** Escape, a backdrop click, the header close control, and the footer Cancel action each close the dialog once and never send a message. Escape and the backdrop are handled by Spartan, so `cancelled` is emitted only by the pad's own controls and the host never receives two close signals for one gesture. Dismissing discards the unsaved drawing, which is the same outcome as the explicit Cancel action.
- **Reflow:** the dialog panel is a transparent wrapper around the card. It is capped to the viewport height (`max-h-[calc(100dvh-2rem)]`) and scrolls (`overflow-y-auto`), so Clear, Cancel, and Send stay reachable at 200% and 400% zoom and on landscape phones; the previous fixed backdrop had no scroll container, so controls beyond the viewport were unreachable. It keeps a 1rem gutter on narrow screens and grows to the card width (42rem) from the `sm` breakpoint. Spartan blocks page scrolling behind the dialog, and the Spartan scrim replaces the previous bespoke `bg-black/60` backdrop.
- **Teardown:** leaving the chat room while the pad is open disposes the overlay and its backdrop.

## Input and responsive behaviour

The drawing surface uses Pointer Events so mouse, pen, and touch share one state machine. Only the primary pointer and the primary mouse button can begin a stroke. Pointer capture is requested for an active stroke and is released when drawing finishes. `pointerup`, `pointercancel`, and leaving the drawing surface all terminate the local stroke state so an interrupted gesture cannot leave the editor stuck in drawing mode.

The backing raster is always 600 × 400. CSS may scale the canvas for narrow screens or zoom. Pointer coordinates are converted from the rendered rectangle back into raster coordinates before drawing, preserving output resolution at responsive sizes.

## Safety and privacy

The component accepts only colours and brush widths from its configured palettes. Save output is emitted only when browser serialization returns a PNG data URL. The component does not log or persist drawing contents and does not add user identifiers or other metadata to the raster.

Authorization, room membership, block/privacy rules, message size limits, persistence, and real-time fan-out remain server/chat-service responsibilities. A doodle is subject to the same authenticated message-send boundary as other chat message types.

## Accessibility

The canvas has an accessible translated name and description reference. Colour and brush-width choices remain mutually exclusive Spartan radio groups, with translated group-derived accessible labels. Clear, cancel, close, and send controls are native/Spartan-backed keyboard-operable actions. Control rows wrap rather than requiring horizontal scrolling at narrow widths and high zoom.

Freehand drawing itself is a pointer interaction; this component does not claim a keyboard drawing equivalent. The surrounding controls remain available to keyboard and assistive-technology users, and the dialog that hosts the pad provides the modal semantics, focus containment, and Escape handling described above.

## Failure behaviour

If a pointer gesture is interrupted, the active stroke is closed and discarded from the input state while already-rendered pixels remain on the canvas. Pointer-capture failures are treated as recoverable browser-state races and do not prevent drawing.

If canvas serialisation returns a value that is not a PNG data URL, the component fails closed and does not emit `doodleSaved`. Network/send failures happen after this component emits and are handled by the chat host: the host closes the dialog, logs the failure without the drawing contents, and shows a translated error notice (`chatRoom.doodleSendFailed`) so the sender knows the doodle was not delivered. The pad is destroyed when the dialog closes, so a failed send does not retain the drawing and the sender has to redraw it. Retaining the drawing across a failed send would need a pending/failed state on the pad and is deliberately left for a separate change.

## Verification

Focused regression coverage lives in `frontend/src/app/components/doodle-pad/doodle-pad.component.spec.ts` and covers:

- canvas initialization and responsive coordinate scaling;
- pointer start, move, cancellation, capture, and mismatched-pointer isolation;
- configured colour/brush validation;
- template pointer-event wiring;
- clear/cancel stroke cleanup;
- accessible canvas and close-control metadata;
- exactly-once PNG emission and rejection of unexpected serialization formats.

The modal host contract lives in `frontend/src/app/components/chat-room/chat-room.doodle-sharing.spec.ts` and covers:

- the dialog role, modality, translated accessible name, and the absence of dangling `aria-labelledby`/`aria-describedby` references;
- focus entering the dialog, the CDK focus-trap anchors, and focus returning to the Doodle trigger;
- Escape, backdrop, header close, and footer Cancel each closing once without sending a message;
- reopening after dismissal, the scrollable panel classes, and overlay disposal when the chat room is destroyed;
- the persisted caption, the translated timeline image name, and the send-failure notice.

`frontend/src/app/services/i18n.service.spec.ts` guards the doodle translation keys, because `I18nService.translate` echoes an unknown key and that text would otherwise be stored or announced.

The repository frontend CI remains the authoritative full validation gate (`lint`, template/control-flow checks, build, and Vitest suite).

## Rollout and rollback

No schema, API, environment, dependency, or persisted-data migration is required. The change is frontend-only and backward compatible with the existing `doodleSaved`/`cancelled` outputs and chat `doodle` message contract. It uses the Spartan Dialog Helm code that is already installed under `frontend/src/app/components/ui/dialog`.

Rollback is a normal application revert. Existing doodle messages remain readable because their persisted message shape is unchanged.
