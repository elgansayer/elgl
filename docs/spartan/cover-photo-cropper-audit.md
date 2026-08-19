# Cover photo cropper Spartan/Relay audit

Tracks issue #6071 for `frontend/src/app/components/cover-photo-cropper/`.

## Scope and current ownership

`CoverPhotoCropperComponent` is a feature modal that accepts an `imageFile`, delegates the actual crop interaction to `ngx-image-cropper`, stores the latest cropped `Blob`, emits that blob through `saveCover`, and emits `cancelCrop` when the user dismisses the surface.

The component currently mixes three ownership models:

- `ngx-image-cropper` owns the image crop canvas, crop geometry and pointer interaction.
- Spartan Helm already owns the Cancel and Save native buttons through `HlmButton`.
- The modal overlay, dismissal and keyboard behaviour are hand-rolled with focusable `div` elements, click handlers and Enter-key handlers.

The hand-rolled modal shell is the main Spartan migration gap. The repository architecture assigns dialog focus, Escape, backdrop and open-state mechanics to Spartan Dialog, with Relay responsible for product presentation. The crop canvas itself is specialized feature functionality and should remain `ngx-image-cropper`; introducing a Spartan primitive around crop geometry would duplicate a capability Spartan does not own.

The component does not inject `Router`, call HTTP APIs, write storage or call an analytics service. Its integration boundary is its required `imageFile` input and the `saveCover` / `cancelCrop` outputs. No route or analytics contract is implemented inside this surface.

A sibling `cover-photo-uploader` component contains a separate, bespoke crop implementation. That duplication is worth resolving separately, but this ticket must not broaden into a cross-component rewrite. The migration of this component should preserve its public input/output contract so callers can be consolidated later without coupling that work to the dialog conversion.

## Control, overlay and state inventory

| Surface             | Current implementation                                                                                                               | Behaviour/state                                                                                                        | Spartan/Relay mapping                                      | Migration action                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Modal backdrop      | Fixed full-screen `<div>` with `(click)="cancelCrop.emit()"`, `(keydown.enter)="cancelCrop.emit()"`, `tabindex="0"`, `role="button"` | Click or Enter anywhere on the backdrop cancels                                                                        | Spartan Dialog overlay/backdrop                            | Replace the focusable button-like backdrop with Spartan Dialog dismissal. Do not keep a second click/keyboard state machine beside Spartan. |
| Modal panel         | Nested focusable `<div role="button">` with click and Enter propagation guards                                                       | Prevents backdrop cancellation when interacting inside                                                                 | Spartan Dialog content with Relay sheet/modal presentation | Remove button semantics and propagation-based modal mechanics. Let Dialog content define the interaction boundary and focus lifecycle.      |
| Dialog title        | `<h3>` using `coverPhoto.crop`                                                                                                       | Names the crop task visually                                                                                           | Dialog title semantics plus Relay typography               | Keep translated copy and associate it with the dialog through the approved Dialog title composition.                                        |
| Crop viewport       | Relay-styled wrapper around `<image-cropper>`                                                                                        | Constrains visible crop UI to `max-h-64`                                                                               | Feature presentation                                       | Keep presentation ownership local/Relay. No Brain primitive is needed solely for a viewport.                                                |
| Image cropper       | `ngx-image-cropper`                                                                                                                  | Receives the required `File`; maintains 3:1 ratio; resizes output to 1200x400 JPEG; emits crop and load-failure events | Specialized feature dependency                             | Retain `ngx-image-cropper`. Do not recreate its crop interaction with feature-level pointer/keyboard code during the Spartan migration.     |
| Cropped-image state | `signal<Blob                                                                                                                         | null>(null)`                                                                                                           | Stores the latest truthy `event.blob` and gates Save       | Feature state                                                                                                                               | Preserve. Spartan owns control mechanics, not the crop result. |
| Load failure        | `(loadImageFailed)="onLoadImageFailed()"` calling `console.error`                                                                    | Records a console error only; no user-visible error state                                                              | Relay feedback/error presentation plus feature error state | Follow-on work should expose an accessible translated error state. Do not treat a library load failure as Dialog failure.                   |
| Cancel action       | `<button hlmBtn>`                                                                                                                    | Emits `cancelCrop`                                                                                                     | Spartan Helm/Relay button plus Dialog close contract       | Keep a native Spartan-backed button, add explicit `type="button"`, and route cancellation through one authoritative close path.             |
| Save action         | `<button hlmBtn>` with `[disabled]="!croppedBlob()"`                                                                                 | Calls `save()`; emits the current blob only when one exists                                                            | Spartan Helm/Relay button                                  | Keep native button semantics and the feature-owned enablement rule. Add explicit `type="button"`.                                           |
| Save disabled state | Native `[disabled]` binding                                                                                                          | Prevents save before a crop result exists                                                                              | Feature validity + Spartan disabled mechanics              | Preserve native disabled semantics. Do not replace with visual-only disabled styling or a clickable `aria-disabled` container.              |
| Save output         | `saveCover = output<Blob>()`                                                                                                         | Emits the exact stored blob                                                                                            | Feature contract                                           | Preserve shape and timing. Do not upload or mutate profile state inside this component as part of UI migration.                             |
| Cancel output       | `cancelCrop = output<void>()`                                                                                                        | Signals dismissal to caller                                                                                            | Feature contract                                           | Preserve exactly-once cancellation semantics across backdrop, Escape and explicit Cancel paths.                                             |

Every interactive element and state in the current surface is accounted for. The only bespoke generic interaction state machine is the modal shell.

## Existing behaviour contract

The migration must preserve these externally observable rules:

1. `imageFile` remains a required input.
2. The cropper receives the selected file directly through `[imageFile]`.
3. The crop maintains a 3:1 aspect ratio.
4. The requested output dimensions remain 1200 by 400 and the format remains JPEG.
5. A truthy cropped blob replaces `croppedBlob`; a null/absent blob currently leaves the previous valid blob intact.
6. Save is disabled until a valid cropped blob exists.
7. `save()` emits the exact stored blob through `saveCover` and emits nothing when the state is null.
8. Explicit cancellation emits `cancelCrop` and does not emit `saveCover`.
9. Backdrop dismissal currently cancels the surface.
10. The component itself performs no navigation, upload, persistence, profile mutation or analytics action.

The current Enter-on-backdrop behaviour is an artifact of making the overlay a `role="button"`, not a desirable product contract. The Spartan conversion should preserve intentional dismissal, not preserve invalid modal semantics merely because the old container listened for Enter.

## Spartan and Relay ownership

### Migrate the modal shell to Spartan Dialog

Spartan Dialog should own:

- dialog role and `aria-modal` semantics
- focus entry and focus containment
- Escape handling
- focus restoration after close
- overlay/backdrop lifecycle
- close/dismiss state mechanics

Feature code should translate a permitted Dialog close into `cancelCrop` exactly once. It should not retain the root `(click)` cancellation handler, inner `$event.stopPropagation()` guard, focusable backdrop, focusable panel or custom document-level key handling beside Spartan.

If a Relay modal/dialog composition exists at implementation time, the feature should consume it. Otherwise the repository architecture permits the installed Helm Dialog composition as a migration step. Feature code must not import Spartan Brain directly when the approved Helm/Relay layer provides the capability.

### Keep button behaviour Spartan-backed

Both actions already use `HlmButton`. The migration should keep native `<button>` elements and use the approved Relay button wrapper when one owns the same product-level variants. Product copy, placement and feature rules remain local.

The conversion ticket should not add another bespoke button component or custom focus/disabled behaviour.

### Keep crop interaction feature-owned

`ngx-image-cropper` is not a generic Relay/Spartan interaction class. Keep it responsible for crop manipulation and image processing. The feature remains responsible for:

- crop configuration
- storing the latest crop result
- deciding when Save is enabled
- converting a successful save into `saveCover`
- deciding how crop-library failure is represented to the user

Do not replace the crop library with raw mouse/touch handlers merely to reduce dependencies. The sibling uploader's hand-rolled crop box is not the target architecture for this component.

## Accessibility findings and requirements

The current surface has material accessibility gaps that the migration should address:

1. **Use real dialog semantics.** The root is currently a button-like backdrop rather than a dialog. Spartan Dialog should provide the modal semantics and focus contract.
2. **Remove fake button roles.** Neither the backdrop nor the panel is a user action that should appear in the accessibility tree as a button. Their `role="button"` and `tabindex="0"` values create misleading focus stops.
3. **Do not make Enter on the panel meaningful.** The current inner Enter handler only stops propagation. Proper Dialog content eliminates this non-semantic keyboard behaviour.
4. **Manage focus deterministically.** Opening should place focus at an intentional location inside the dialog, Tab should remain within the modal, Escape should follow the dismissal policy, and close should restore focus to the invoking control.
5. **Associate the title with the dialog.** `coverPhoto.crop` should be the accessible Dialog title, not only a visible heading.
6. **Preserve native disabled Save semantics.** Save must remain a real disabled button while no cropped blob exists.
7. **Add explicit button types.** Cancel and Save should use `type="button"` so later composition inside a form cannot create accidental submission.
8. **Expose load failure to the user.** Logging `Failed to load image for cropping` to the console is not an accessible failure state. A follow-on implementation should render translated status/error feedback and keep retry/cancel actions reachable.
9. **Verify the cropper's keyboard contract.** The third-party crop surface must remain operable for the supported input methods. If the library cannot provide an equivalent keyboard path for crop adjustment, the product needs an accessible alternative or documented controls rather than a pointer-only custom fallback.
10. **Support high zoom and reflow.** The fixed centered panel and `max-h-64` crop viewport must not push Cancel/Save outside the reachable viewport at 200% or 400% zoom. The Dialog content should be scrollable when required.
11. **Preserve touch operability.** Cancel, Save and crop manipulation targets need usable touch sizes at the 390px baseline.
12. **Use translated user-facing feedback.** The current visible title/buttons are translated. Any new error, help or accessible-label text must also use repository i18n paths.

## RTL and multilingual requirements

The current component uses no physical left/right spacing utilities, which is the correct baseline. Preserve that.

- Continue using direction-neutral or logical spacing utilities.
- Do not introduce `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*` or `pr-*` during migration.
- Product-authored dialog/error/help copy must use `TranslatePipe` or `I18nService` according to the repository i18n contract.
- Long translated title and action labels must wrap without clipping the crop viewport or making actions unreachable.
- The crop image itself has no text direction, so do not mirror image pixels merely because the document direction is RTL.
- Dialog focus order should remain logical in both LTR and RTL. Visual reversal must not create a keyboard-order mismatch.
- Keep system UI typography for translated content so supported non-Latin scripts retain glyph coverage.

## Theme and token findings

This audit does not change visual styling, but it records token ownership for the theme-parity stage:

- `bg-black/70` is a fixed scrim rather than a Relay overlay/scrim semantic role.
- `rounded-xl` and `shadow-2xl` bypass the documented Relay sheet radius/elevation hierarchy and should be aligned with the approved modal recipe.
- Button classes duplicate presentation on top of `hlmBtn`; follow-on work should prefer the approved Relay/Helm variants and semantic tokens rather than maintaining a second feature-level button style contract.
- The Save button correctly uses `primary` plus `on-fill`, preserving per-user primary accent behaviour and theme-aware fill text.
- Surface and text colours already use Relay semantic tokens for the panel and button copy.

The interaction conversion should avoid broad visual restyling beyond what is necessary to adopt Dialog. Token/radius/elevation cleanup belongs in the dedicated theme-parity ticket so behavioural and visual changes remain independently reviewable.

## Sibling cover-photo uploader risk

`frontend/src/app/components/cover-photo-uploader/` contains another cropping implementation with custom drag/resize handlers and upload behaviour. It is a separate feature surface with its own numbered Spartan migration tickets.

For this cropper migration:

- do not make `CoverPhotoCropperComponent` perform the uploader's HTTP/presigned-URL flow
- do not copy the uploader's pointer handlers into this component
- do not remove or rename the cropper public outputs solely to match the sibling
- consider a later product-level consolidation only after caller usage and both surfaces' contracts are audited

This separation prevents a small UI migration from silently becoming a media-upload architecture rewrite.

## Migration risks and prerequisites

1. **Double cancellation.** A Dialog close callback plus an explicit Cancel click handler can emit `cancelCrop` twice. Establish one authoritative close translation and test exactly-once emission.
2. **Backdrop-policy drift.** Backdrop click cancels today. Configure the approved Dialog path deliberately rather than relying on library defaults that may differ.
3. **Focus regression.** Keeping the fixed `div` shell while only changing styles would leave the core interaction defect unresolved. Dialog mechanics are required for #6072.
4. **Stale crop result.** `onImageCropped()` intentionally ignores null blobs, so a previous valid blob can remain enabled after a later null event. Preserve this current contract in the interaction-only ticket unless product behaviour is intentionally changed with a regression test.
5. **Load-failure invisibility.** The current console-only error is not user facing. Introduce an accessible feature error state without conflating it with provider/dialog errors.
6. **Third-party crop accessibility.** `ngx-image-cropper` remains a required specialized dependency. Verify its actual keyboard/touch semantics before claiming full accessibility; add an application-level alternative if a supported input method cannot complete the task.
7. **Scroll/zoom clipping.** Moving to Dialog must keep title, crop area and actions reachable when viewport height is constrained or zoom is high.
8. **Button-submit drift.** Set explicit button types during conversion to prevent future parent form composition from changing behaviour.
9. **Visual-stage overlap.** Keep scrim, radius, shadow and button token cleanup scoped to the theme-parity follow-on where possible.
10. **Sibling consolidation scope creep.** The separate uploader crop implementation is a product architecture concern, not a prerequisite for migrating this modal shell.

No new Spartan primitive prerequisite is identified. The repository already has an installed Dialog capability, and `HlmButton` is already in use. `ngx-image-cropper` remains the specialized crop engine.

## Required regression coverage for follow-on stages

The existing component spec covers creation, storing a successful blob, retaining an existing blob after a null crop event, successful save output, no-op save without a blob, a non-throwing load failure and direct cancellation. Follow-on work should add focused coverage for:

- real Dialog semantics and title association
- deterministic focus entry, containment and restoration
- Escape and allowed backdrop dismissal emitting `cancelCrop` exactly once
- explicit Cancel emitting exactly one cancellation event
- clicks/interactions inside Dialog content not cancelling the crop
- Save disabled before a crop result and enabled after a valid blob
- Save remaining a native button with `type="button"`
- Cancel remaining a native button with `type="button"`
- exact `Blob` identity through the `saveCover` output
- translated, perceivable load-failure feedback
- crop configuration preserving 3:1, 1200x400 and JPEG output settings
- RTL layout without physical-direction utilities or image mirroring
- keyboard, touch and pointer completion paths for the crop surface
- 390px/mobile plus 200% and 400% zoom/reflow with all required actions reachable
- light/dark and per-user primary accent parity after the visual stage

## Verification

This audit is documentation-only and intentionally changes no runtime, interaction or visual contract. No component test or design-preview update is required in this ticket.

The follow-on implementation should run the repository frontend gate:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

For any mapped visual-contract change, also run the repository design-sync check required by the current CI/design workflow.

## Audit result

**Mapped and ready for interaction migration.** The crop canvas is already delegated to the correct specialized dependency and both actions are Spartan Helm-backed. The primary defect is the hand-rolled modal shell, which should move to the approved Relay/Spartan Dialog composition in #6072 while preserving `imageFile`, `saveCover`, `cancelCrop` and crop configuration. No custom Brain capability or new primitive is required.
