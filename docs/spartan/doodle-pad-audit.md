# Doodle pad Spartan/Relay audit

Issue: #6153

Target: `frontend/src/app/components/doodle-pad`

Status: implementation baseline for the Spartan UI + Claude Design migration.

## Scope

`DoodlePadComponent` is a feature-specific freehand drawing surface used from chat. It owns drawing state, canvas coordinate handling, raster serialisation, and the `doodleSaved` / `cancelled` outputs. Generic control behaviour, overlay behaviour, selection semantics, focus management, and product styling should be owned by Spartan/Relay where an approved primitive exists.

The freehand canvas itself should remain a native `<canvas>` backed by feature code. Spartan does not provide a meaningful replacement for the drawing engine, and introducing a generic Brain primitive solely to increase Spartan usage would violate the repository ownership contract.

## Current integration and product contract

The only current host is `ChatRoomComponent`.

- Chat opens the doodle surface from a translated Relay secondary button.
- `ChatRoomComponent.showDoodleModal` owns visibility.
- The host currently renders the doodle pad inside a hand-built fixed backdrop rather than a Spartan Dialog.
- Saving calls `canvas.toDataURL('image/png')` and emits the resulting data URL through `doodleSaved`.
- `ChatRoomComponent.onDoodleSaved()` closes the surface and sends a chat message with `message_type: 'doodle'` and the emitted data URL as `media_url`.
- Cancelling emits `cancelled`; the host closes the surface without sending.
- The doodle pad has no route or navigation contract.
- No analytics hook is present in the component or its current host integration.
- The component performs no API call directly.

This boundary must be preserved during migration. The feature component must not begin sending chat messages itself, and the host must continue to own message delivery and modal visibility.

## Control, state, and ownership inventory

| Element or behaviour          | Current implementation                                        | Target owner                                                         | Migration decision                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal backdrop and open state | `ChatRoomComponent` fixed `div` plus `showDoodleModal` signal | Spartan Dialog through Relay composition                             | Replace hand-built overlay behaviour in the interaction stage. Spartan should own focus containment, Escape, backdrop dismissal, and focus restoration. Chat keeps product open/closed state. |
| Card shell                    | `AppCardComponent`                                            | Relay                                                                | Keep Relay ownership. Do not introduce Brain for a presentation-only container.                                                                                                               |
| Title                         | translated heading                                            | Relay / feature presentation                                         | Keep translated content and associate it with the Dialog when the host migrates.                                                                                                              |
| Header close action           | direct `hlmBtn`, hard-coded English accessible name           | Relay/Spartan button, ideally Dialog close composition               | Preserve the cancel output while moving generic close mechanics and accessible naming to the shared interaction layer.                                                                        |
| Drawing surface               | native `<canvas>` with mouse and touch handlers               | Native browser plus feature code                                     | Keep the canvas. Feature code owns coordinates, brush strokes, and raster data. Consolidate input handling without inventing a Spartan drawing primitive.                                     |
| Colour selector group         | six direct `hlmBtn` swatches                                  | Relay single-selection control backed by Spartan selection semantics | Treat the palette as one mutually exclusive group. Prefer a Relay wrapper over Spartan Toggle Group or Radio Group after confirming the installed/current API with the Spartan CLI/docs.      |
| Colour swatch state           | `currentColor` plus selected ring                             | Feature state with Relay/Spartan selected semantics                  | Feature owns the actual colour value. Shared interaction must expose selected state, group naming, focus, and touch behaviour.                                                                |
| Brush-width selector group    | four direct `hlmBtn` controls                                 | Relay single-selection control backed by Spartan selection semantics | Treat widths as a mutually exclusive group rather than unrelated command buttons.                                                                                                             |
| Brush-width state             | `brushWidth`                                                  | Feature state                                                        | Feature keeps the numeric width. Shared controls expose selected state and keyboard/focus semantics.                                                                                          |
| Clear action                  | `AppButtonSecondaryComponent`                                 | Relay/Spartan button                                                 | Keep. Clearing the raster remains feature behaviour. Use the semantic destructive treatment in the later token stage without creating a bespoke button state machine.                         |
| Footer Cancel action          | `AppButtonSecondaryComponent`                                 | Relay/Spartan button plus Dialog close behaviour                     | Keep the product action. Prefer Dialog close composition once the host is a Spartan Dialog.                                                                                                   |
| Send action                   | `AppButtonPrimaryComponent`                                   | Relay/Spartan button                                                 | Keep. The button triggers feature serialisation and output emission only.                                                                                                                     |

There is currently no loading, disabled, network, or server-error state inside `DoodlePadComponent`. Saving is synchronous from the component's perspective. The host owns the asynchronous message-send operation after the component closes.

## State model

The current observable states are:

1. closed or open, owned by `ChatRoomComponent`;
2. idle canvas;
3. active drawing gesture;
4. selected colour;
5. selected brush width;
6. cleared canvas;
7. save/output emission;
8. cancel/output emission.

The component does not currently track dirty versus blank content, undo/redo history, a pending save state, or a local error state. Those are not prerequisites for this migration and should not be invented as incidental product changes.

## Ownership decisions

### Feature-owned

The doodle feature should continue to own:

- the fixed raster backing dimensions and coordinate conversion unless a later product ticket changes them;
- stroke start, move, and stop behaviour;
- brush colour and width values;
- canvas clear behaviour;
- PNG data URL serialisation;
- `doodleSaved` and `cancelled` product outputs;
- the decision about which palette colours and brush widths the product offers.

### Spartan/Relay-owned

Spartan/Relay should own generic interaction concerns:

- Dialog focus containment, Escape handling, backdrop dismissal, and focus restoration;
- button semantics, focus visibility, disabled semantics, and touch sizing;
- mutually exclusive colour/brush selection semantics and keyboard behaviour;
- translated accessible names and group relationships;
- Relay semantic surface, text, border, radius, elevation, and state tokens.

### Native-browser-owned

The native browser remains responsible for:

- `<canvas>` rendering;
- pointer coordinates and events;
- PNG serialisation through `toDataURL`;
- standard button activation once controls are composed through Relay/Spartan.

## Current migration risks and defects

### Overlay ownership

The host currently uses a fixed backdrop `div` rather than Spartan Dialog. It therefore does not inherit the repository-standard focus trap, Escape dismissal, backdrop semantics, initial focus, or focus restoration contract. This is generic modal behaviour and belongs in Spartan during #6154 rather than in feature code.

The host must continue to close through the same product state and outputs. Dialog dismissal should not emit duplicate cancellation events when the header close action, footer Cancel action, Escape, or backdrop is used.

### Drawing input handling

The canvas duplicates mouse and touch event paths. A focused implementation should consider converging these on Pointer Events so one input model covers mouse, pen, and touch. The implementation must also handle interruption cases such as `pointercancel` and leaving/releasing outside the drawing surface so the component cannot remain stuck in a drawing state.

This is still feature-specific input logic, not a reason to add a generic Spartan primitive.

### Canvas accessibility

The current canvas has no accessible name, description, or instructions. Screen-reader users receive no meaningful explanation of the surface. The drawing interaction itself also has no keyboard equivalent.

The migration must at minimum provide a translated accessible name and concise instructions, while preserving fully keyboard-operable colour, brush, clear, cancel, and send controls. If a useful non-pointer drawing alternative is introduced in the future, it should be a separate product/accessibility decision rather than an improvised migration side effect.

### Selection semantics

Colour and brush controls are mutually exclusive choices but are currently exposed as independent buttons. They do not expose `aria-pressed`, radio semantics, or a named group relationship. Visual selection alone is insufficient for assistive technology.

The implementation stage should use an approved single-selection interaction primitive. Confirm the current Spartan API and installed component inventory before choosing Toggle Group versus Radio Group. Do not guess selectors and do not import Brain directly from this feature if a Relay wrapper exists or can be added cleanly.

### Hard-coded accessible copy

The header close button uses `aria-label="Cancel doodle"`. Colour swatches build names from `'Select ' + color`, and brush controls build names from `w + 'px stroke width'`. These strings bypass `TranslatePipe`/`I18nService` and must be replaced with translated labels.

Hex codes should not be the only human-readable colour names. The product palette needs localisable semantic colour names so screen-reader users can distinguish choices meaningfully.

### Hard-coded visual values and theme parity

The component contains a dark canvas fill of `#1e1e1e`, a fixed six-colour palette, and a stylesheet with legacy hard-coded greys, a purple gradient, white text, and a raw ring colour. Several stylesheet rules duplicate or override Relay classes and may now be dead because the template uses Relay button wrappers.

#6155 should remove product-chrome hard-coded values and reconcile dead styles with Relay tokens. The actual drawing ink palette is user content rather than interface chrome, so fixed palette colours can remain where product intent requires them, but they need explicit semantic names and contrast review. Product state/focus rings, backgrounds, borders, text, and controls must use Relay tokens.

The default black brush on the current dark `#1e1e1e` canvas is also low visibility and must be evaluated in the theme/token pass.

### Local state style

`currentColor`, `brushWidth`, and `isDrawing` are mutable fields rather than signals. The current click-driven template updates work under Angular change detection, but the repository's Angular contract prefers signals for component state. If #6154 touches these states, migrate them to signals rather than introducing additional mutable state. Do not expand scope solely to perform a mechanical rewrite if no interaction change requires it.

### Responsive and zoom behaviour

The backing canvas is fixed at 600 by 400 while CSS scales it with `max-w-full`. `getPos()` compensates by scaling client coordinates back into canvas coordinates, which is the correct existing product contract to preserve.

The toolbar and footer need explicit 390px, high-zoom, and long-translation verification. The current footer uses a single `flex justify-between` row and can become crowded when labels expand. Required actions must remain visible and operable at 200% and 400% zoom.

### Test safety net

The entire `DoodlePadComponent` Vitest suite is currently disabled with `describe.skip`, and its mouse, touch, and template-listener groups are also skipped. Existing tests describe useful behaviour, but none currently protect production changes.

This is a high-priority migration risk. #6157 should restore the suite and expand it rather than relying on visual/manual verification only.

## Accessibility contract for the migrated surface

The completed surface should satisfy these invariants:

- the doodle surface is hosted by an accessible Dialog with an associated translated title;
- initial focus is deterministic and closing returns focus to the chat Doodle trigger;
- Escape, backdrop, header close, and footer Cancel each close once without duplicate outputs;
- the canvas has a translated accessible name and concise instructions;
- colour and brush choices are exposed as named single-selection groups with selected state available to assistive technology;
- every interactive control has a visible focus indicator and an appropriate mobile touch target;
- colour swatches have translated semantic names rather than only hexadecimal identifiers;
- clear, cancel, and send remain fully keyboard operable;
- high zoom and long translations do not hide the canvas controls or required actions;
- reduced-motion preferences are respected for non-essential hover/selection transforms;
- focus/selection meaning does not rely on colour alone.

## RTL and internationalisation contract

The current layout mainly uses `gap`, flex layout, and no physical left/right spacing utilities, which is a good base for RTL. The migration must preserve logical layout and must not add physical-direction utilities.

The following accessible content needs translation ownership:

- dismiss/close doodle;
- canvas name;
- canvas drawing instructions;
- colour-selector group name;
- semantic names for each palette colour;
- selected-colour wording where required by the chosen primitive;
- brush-width selector group name;
- stroke-width label including a localisable value/unit representation.

Existing visible translation keys such as `doodle.title`, `doodle.colorLabel`, `doodle.brushLabel`, `doodle.clearBtn`, `doodle.cancelBtn`, and `doodle.sendBtn` should remain canonical where they already express the correct product copy.

The emitted PNG data URL and numeric drawing coordinates are data contracts and must never be localised.

## Theme and responsive contract

#6155 owns the visual token conversion, but #6154 must not make that later work harder.

- Product chrome uses Relay semantic surfaces, borders, text, focus, radius, and elevation.
- Light and dark themes are first-class.
- Per-user `primary` accent behaviour remains intact for selected/focus treatment.
- Text on saturated UI fills uses `on-fill` rather than hard-coded white.
- Drawing palette colours may remain explicit content colours only when they are treated as product palette data, named accessibly, and independently contrast-checked.
- The 390px baseline must keep every required action available without horizontal clipping.
- Tablet and desktop should preserve the drawing aspect ratio without simply stretching the canvas beyond a useful size.
- At 200% and 400% zoom, toolbars/actions may wrap or stack rather than overflow.

## Recommended implementation sequence

### #6154: controls and interaction ownership

1. Migrate the chat-host overlay to the approved Spartan Dialog composition while preserving `showDoodleModal`, `doodleSaved`, and `cancelled` product boundaries.
2. Replace the header close behaviour with Dialog/Relay-owned close mechanics and translated naming.
3. Convert colour and brush selectors to a named single-selection pattern after confirming the current Spartan CLI/docs contract.
4. Prefer one Pointer Events drawing path for mouse, pen, and touch if it can be done without changing drawing semantics.
5. Preserve clear, cancel, and send through existing Relay button primitives.

### #6155: Relay tokens, theme, and responsive layout

1. Remove legacy hard-coded product chrome from the SCSS.
2. Reconcile canvas background and selected-state contrast across light/dark themes.
3. Keep fixed drawing palette values only as explicit, named content colours.
4. Make toolbar/footer composition safe at 390px, long translations, and wider layouts.

### #6156: accessibility, RTL, zoom, and input methods

Verify screen-reader relationships, Dialog focus lifecycle, group semantics, pointer/pen/touch behaviour, keyboard operation for all controls, RTL, reduced motion, forced colours, and 200%/400% zoom/reflow.

### #6157: regression and design-preview lock

Restore the currently skipped component suite, add interaction/accessibility regression coverage, and synchronise the HelloTalk Design System preview for representative light/dark and mobile/wider states.

## Required regression coverage

At minimum, the completed migration needs executable coverage for:

1. component creation and canvas initialisation;
2. canvas dimensions and coordinate scaling after responsive CSS resizing;
3. pointer start/move/end drawing flow;
4. pointer cancellation and release outside the surface;
5. current brush colour and width being applied to strokes;
6. mutually exclusive colour selection and assistive selected state;
7. mutually exclusive brush selection and assistive selected state;
8. translated group/control accessible names;
9. clear resetting the raster without closing the Dialog;
10. save emitting exactly one PNG data URL;
11. header close emitting/closing exactly once;
12. footer Cancel emitting/closing exactly once;
13. Escape dismissal;
14. backdrop dismissal according to the chosen product policy;
15. initial focus and trigger focus restoration;
16. no direct chat/API side effect from `DoodlePadComponent`;
17. chat host sending the emitted doodle with `message_type: 'doodle'`;
18. 390px control wrapping without lost actions;
19. RTL-safe composition;
20. light and dark token states;
21. long translated labels at high zoom;
22. reduced-motion selection/hover behaviour where animation remains.

## Verification gate

Implementation PRs for #6154 through #6157 should run the repository's canonical frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Run focused component tests while iterating, then run the full gate before merge. The migration must fix failures in its own branch rather than weakening checks.

## Audit conclusion

The doodle pad already uses Relay card and primary/secondary button wrappers for several actions, so those should be preserved rather than reimplemented. The remaining generic interaction gaps are the hand-built modal host and the two mutually exclusive selection groups. Spartan/Relay should own those behaviours.

The canvas drawing engine is deliberately not mapped to a Spartan primitive. It is specialised feature behaviour and should remain a native canvas with well-tested pointer handling and stronger accessibility metadata. The migration should improve generic interaction ownership without changing the chat message contract, drawing output, or delivery side effects.
