# Cover photo uploader Spartan / Relay audit

Issue: #6076

Target: `frontend/src/app/components/cover-photo-uploader`

Prerequisite: #5462 is complete.

## Purpose

This document is the ownership and migration map for `CoverPhotoUploaderComponent`. It records every interactive control, state, overlay, side effect, and bespoke utility before the follow-up Spartan conversion work changes the surface.

The current component already uses Spartan Helm buttons. The main migration risk is not button ownership. It is the bespoke crop interaction, hidden-file-input trigger, upload state communication, and duplicated crop responsibilities that also exist in `CoverPhotoCropperComponent`.

## Current surface

`CoverPhotoUploaderComponent` is a standalone Angular component that accepts `currentCoverUrl` and emits `coverPhotoUploaded` after a successful upload. It owns file selection, an in-place crop editor, preview generation, a direct R2 upload, backend confirmation, and local reset state.

The surface has two primary modes:

1. Cover display / file-selection mode when `imageSource()` is empty.
2. Editing mode after a local image has been selected.

Editing mode can additionally be in crop-active, crop-preview-ready, and uploading states.

## Control and state inventory

| Current UI / state       | Current implementation                                               | Spartan / Relay owner                                                     | Migration decision                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hidden file picker       | Native `<input type="file">`, accepts JPEG, PNG, WebP                | Native browser semantic control, composed by Relay                        | Keep native input. Relay owns the visible trigger and accessible labelling. Do not replace the file input with a generic Spartan text input.                                          |
| Cover image              | Native `<img>` bound to `currentCoverUrl()`                          | Relay media composition                                                   | Keep native image semantics and Relay token-driven layout.                                                                                                                            |
| Empty cover placeholder  | Gradient surface block                                               | Relay composition                                                         | Keep as presentation only. Ensure it has no fake interactive semantics.                                                                                                               |
| Add/change cover trigger | Focusable `<div role="button">` that calls `fileInput.click()`       | Relay action composition backed by a native button or labelled file input | Replace the hand-authored pseudo-button with a real semantic trigger. Spartan Button is appropriate if the visual treatment is action-like.                                           |
| Trigger icon             | Inline SVG                                                           | Relay icon/presentation                                                   | Keep decorative and hidden from the accessibility tree when adjacent text supplies the name.                                                                                          |
| Selected source image    | Native `<img>` showing the data URL                                  | Relay media composition                                                   | Keep native image. Localized alternative text is required.                                                                                                                            |
| Crop overlay             | SVG mask plus absolutely positioned crop box                         | Bespoke crop capability                                                   | Do not promote this implementation to a general primitive. Prefer the existing `CoverPhotoCropperComponent` / `ngx-image-cropper` capability or a single approved cover-crop adapter. |
| Movable crop box         | Pointer/touch handlers on a `<div>`                                  | Bespoke crop capability                                                   | Consolidate behind the approved crop adapter. Current pointer-only mechanics do not satisfy keyboard accessibility.                                                                   |
| Four resize handles      | Pointer/touch-only `<div>` handles                                   | Bespoke crop capability                                                   | Consolidate behind the approved crop adapter. Do not expose unlabeled div handles as the long-term UI.                                                                                |
| Crop action              | `<button hlmBtn>`                                                    | Spartan Helm Button                                                       | Retain Spartan ownership. Relay owns product copy, variant choice, spacing, and state composition.                                                                                    |
| Apply crop action        | `<button hlmBtn>`                                                    | Spartan Helm Button                                                       | Retain.                                                                                                                                                                               |
| Cancel crop action       | `<button hlmBtn>`                                                    | Spartan Helm Button                                                       | Retain. Distinguish crop cancellation from abandoning the whole selected image in copy where necessary.                                                                               |
| Upload action            | `<button hlmBtn>` with disabled state                                | Spartan Helm Button                                                       | Retain. Relay owns upload state and status communication.                                                                                                                             |
| Reset / abandon action   | `<button hlmBtn>`                                                    | Spartan Helm Button                                                       | Retain. Confirm product semantics and naming because it currently uses the same translated `common.cancel` label as crop cancellation.                                                |
| Cropped preview label    | Translated paragraph                                                 | Relay typography                                                          | Keep, using Relay text tokens.                                                                                                                                                        |
| Cropped preview image    | Native `<img>`                                                       | Relay media composition                                                   | Keep. Alternative text must be localized.                                                                                                                                             |
| Uploading state          | `isUploading()` changes button label and disabled state              | Relay async-action composition over Spartan Button                        | Keep the state, but expose progress/busy semantics beyond label text alone.                                                                                                           |
| Crop-active state        | `isCropping()` toggles overlay and action set                        | Relay state composition                                                   | Preserve. Focus and announcement behaviour must be explicit after migration.                                                                                                          |
| Preview-ready state      | `croppedPreviewUrl()` controls preview and enables meaningful upload | Relay state composition                                                   | Preserve. Upload must remain a no-op when no cropped preview exists.                                                                                                                  |
| Source-selected state    | `imageSource()` switches the entire surface to editor mode           | Relay state composition                                                   | Preserve.                                                                                                                                                                             |

## Existing Spartan ownership

All four editing actions already use `hlmBtn` from `@spartan-ng/helm/button`:

- Crop
- Apply crop
- Cancel crop
- Upload
- Reset / abandon

The follow-up conversion must not replace these with another project-local button abstraction. It should normalize variants/classes to the approved Relay button recipes while leaving behaviour on the Spartan primitive.

There is no current Spartan primitive requirement for the native file input or image elements.

## Bespoke capability requiring an adapter decision

The in-component crop editor is the major bespoke control. It implements all of the following itself:

- SVG masking
- crop rectangle placement
- mouse drag tracking
- touch drag tracking
- four resize handles
- crop-boundary clamping
- canvas rendering
- JPEG preview generation

The repository also has `CoverPhotoCropperComponent`, which wraps `ngx-image-cropper` for the same 3:1 cover-photo use case. Maintaining two independent crop engines creates behavioural, accessibility, and testing drift.

The preferred migration is to converge on one cover-photo crop capability and make the uploader compose it. `CoverPhotoCropperComponent` should itself satisfy its Spartan/Relay migration contract before becoming the shared implementation. If that component is not suitable, introduce one narrowly scoped Relay cover-crop adapter rather than a universal crop primitive.

Do not preserve the custom pointer/touch crop implementation merely to avoid changing internals. Preserve the user-visible 3:1 crop contract and output behaviour.

## Behaviour and state contracts to preserve

### File selection

- Accepted file types are `image/jpeg`, `image/png`, and `image/webp` at the browser picker level.
- Selection is read through `FileReader` into a data URL.
- Selecting a new source clears the previous cropped preview and leaves crop mode inactive until requested.
- The visible add/change action activates the hidden file picker.

The implementation currently relies primarily on the input `accept` filter and does not expose a user-facing invalid-file error state. A follow-up should not invent silent validation rules. If stronger validation is introduced, it needs localized feedback and tests.

### Crop initialization

After the selected image loads, the component records its natural dimensions and initializes a centered 3:1 crop rectangle. The initial crop is bounded to roughly 80 percent of the image and capped by the component's current sizing logic.

The 3:1 cover-photo aspect ratio is a product contract and must survive consolidation with the dedicated cropper.

### Crop application

Applying the crop draws the selected region to an off-screen canvas and serializes a JPEG data URL at quality `0.9`. This becomes `croppedPreviewUrl()` and exits crop mode.

Canceling crop mode does not discard the selected source image. Resetting the uploader does.

### Upload

Upload is intentionally gated on a cropped preview. `uploadCropped()` returns without network activity when `croppedPreviewUrl()` is empty.

A successful upload performs three externally visible steps:

1. POST `${environment.apiUrl}/media/cover/presigned-url` with a generated JPEG filename, content type, and `covers` folder.
2. PUT the generated blob to the returned `uploadUrl` using `fetch` and `Content-Type: image/jpeg`.
3. POST `${environment.apiUrl}/media/cover/confirm` with the returned `objectKey`.

After confirmation, the component emits `coverPhotoUploaded` with the backend-provided `coverUrl`, then resets local editor state.

The request sequence and emitted-output contract are migration invariants. Spartan/Relay conversion must not move these side effects into visual primitives.

### Failure behaviour

`isUploading()` is reset in `finally`. Upload failures are currently written to `console.error` and do not have an in-surface error message or retry affordance.

That is an existing product/accessibility gap, not a reason to weaken the upload flow during migration. Any new failure UI should be a Relay-level status composition with localized copy and explicit tests.

### Reset

`reset()` clears:

- `imageSource`
- `isCropping`
- `isUploading`
- `croppedPreviewUrl`
- the stored `originalImage`

This behaviour must remain deterministic after component decomposition.

## Navigation and analytics

The component has no router navigation contract and no analytics calls in its current implementation.

Do not add navigation or analytics as an incidental consequence of the primitive conversion. If product analytics are added later, they should be specified independently rather than hidden inside a Spartan wrapper.

## Accessibility audit

### File-selection trigger

The current visible trigger is a `div` with `role="button"`, `tabindex="0"`, click handling, and Enter handling. It has several issues that the conversion must correct:

- Space does not activate it like a native button.
- The visible overlay uses `opacity-0` and only becomes visible on `group-hover`, so keyboard focus does not receive equivalent reveal behaviour.
- A native semantic button or correctly labelled file-input association avoids recreating button keyboard semantics.
- Focus-visible treatment must remain obvious in both themes.

### Crop controls

The crop box and resize handles are mouse/touch driven and have no keyboard operation, accessible names, value descriptions, or instructions. This is the largest accessibility blocker in the current surface.

The approved crop capability must provide an equivalent keyboard-accessible path or another accessible way to define the crop. Do not mark the migration complete while pointer-only resize handles remain the only way to adjust the crop.

### Images

`currentCoverUrl()` already uses translated alternative text. The editor image currently uses the hardcoded text `Image to crop`, and the generated preview uses `Cropped preview`.

Both product-authored strings must move to translation keys. Decorative image treatment, if chosen instead, must be intentional and tested rather than achieved through empty copy accidentally.

### Async state

Changing the Upload button label to `common.uploading` and disabling the button is useful but insufficient as the only status signal. The migrated composition should expose an appropriate busy/status semantic so assistive technology can perceive the transition and completion/failure states.

Avoid a noisy live region for every internal crop movement. Announce meaningful state changes only.

### Duplicate cancellation labels

Crop cancellation and full editor reset currently both render `common.cancel`. They do different things. The product copy should make the destructive scope understandable if user research/product wording supports it, particularly for screen-reader users encountering actions out of visual context.

### Touch and target size

Keep interactive actions at or above the project's touch-target expectations. Crop resize affordances require particular attention on touch screens; the current 12px visual handles are not acceptable as the effective target unless a larger invisible hit area is provided.

## RTL and internationalization

The component already uses logical `start` / `end` utilities on crop-handle positioning, which is consistent with the Relay RTL rule. Continue using logical spacing and positioning for product chrome.

Cropping itself is coordinate-based and must not mirror image pixels simply because document direction changes. RTL should affect action order/layout only where the product convention requires it, not the underlying image coordinate system.

All product-authored strings must use `TranslatePipe`. The current hardcoded editor and preview alternative text are exceptions to fix in the implementation ticket.

Test long translations and non-Latin scripts without clipping at 200 percent zoom. Action rows must wrap instead of forcing horizontal overflow.

## Theme and token contract

The current surface already uses Relay-style semantic tokens including `surface-*`, `text-*`, `primary`, `success`, `danger`, and `on-fill`. Preserve dynamic per-user primary accent behaviour by using `primary` rather than hardcoded brand colours.

The black crop scrim is functional image-overlay chrome. If a dedicated overlay/scrim token exists at implementation time, prefer it. Otherwise document the exception rather than introducing a new arbitrary product colour.

Button variants should be expressed through the approved Relay recipes around Spartan Button rather than re-styling each action with divergent utility bundles.

Validate light and dark themes independently.

## Responsive contract

Verify the complete surface at the program's visual widths:

- 375px
- 768px
- 1440px

Also verify 200 percent browser zoom. The editor must not lose actions, overflow horizontally, or make the crop control unusable at narrow widths.

The current cover frame uses `h-48 md:h-64` and a `max-w-2xl` container. Preserve the intended cover-photo aspect presentation unless the product design source explicitly changes it.

## Migration risks

1. **Duplicated crop engines.** Converting the uploader without resolving overlap with `CoverPhotoCropperComponent` would lock in two different implementations.
2. **Pointer-only crop manipulation.** A visual-only migration could leave the most important editor interaction inaccessible.
3. **Coordinate mismatch.** The crop box is initialized from natural image dimensions while rendered sizing can differ. Consolidation must verify the chosen crop engine maps displayed coordinates to source pixels correctly.
4. **Upload sequencing.** Moving editor state into child components must not reorder presign, object upload, confirmation, output emission, or reset.
5. **Premature reset.** Failed uploads must retain enough state for a user to retry rather than silently discarding the crop.
6. **Focus loss during mode changes.** Replacing the selection surface with the editor and toggling crop mode can remove the focused element. The migrated flow needs deliberate focus placement.
7. **Untranslated accessible copy.** Hardcoded image alternative text would leave the converted control only partially internationalized.
8. **Busy-state ambiguity.** Disabled Upload without a status semantic can strand non-visual users during network activity.
9. **Button visual drift.** Existing `hlmBtn` controls should converge on Relay variants rather than receiving another layer of one-off classes.
10. **Object/API ownership.** Network and canvas/file behaviour belongs to feature logic, not Spartan primitives. Keep visual primitives side-effect free.

## Required follow-up implementation shape

The conversion ticket should aim for this ownership boundary:

```text
CoverPhotoUploaderComponent
  |- Relay cover-photo composition
  |    |- native labelled file input
  |    |- Spartan Button actions
  |    |- native image previews
  |    |- semantic async/error status
  |
  |- approved cover-crop adapter
  |    `- one shared crop engine, preferably the existing dedicated cover cropper path
  |
  `- feature logic
       |- FileReader / selected file state
       |- crop result state
       |- presigned URL request
       |- R2 upload
       |- backend confirmation
       `- coverPhotoUploaded output
```

Spartan primitives must remain presentation/interaction foundations. They must not own media API endpoints, upload sequencing, or application outputs.

## Regression coverage required by conversion

Existing tests cover component creation, empty-cover rendering, default input state, FileReader selection, upload no-op without a cropped preview, crop guard behaviour, and reset state.

The implementation ticket should preserve those tests and add focused coverage for:

- semantic and keyboard activation of the file-selection trigger, including Space
- visible focus state / focus-equivalent overlay behaviour
- localized alternative text for editor and cropped-preview images
- crop-mode action visibility and cancellation semantics
- keyboard-accessible crop operation through the chosen crop adapter
- 3:1 aspect-ratio preservation
- successful presign -> R2 PUT -> confirm -> `coverPhotoUploaded` flow
- upload failure retaining recoverable state and exposing accessible feedback if new UI is added
- disabled/busy semantics during upload
- reset after successful confirmation
- RTL action/layout behaviour without mirroring image coordinates
- long-copy wrapping and 200 percent zoom behaviour
- light and dark visual coverage at 375px, 768px, and 1440px

If conversion changes the visual contract, update the corresponding Claude Design/design-preview coverage in the same implementation change.

## Verification gate for the follow-up

Run the repository's current frontend verification gate after implementation, including the applicable unit tests, lint/static analysis, build, Spartan ownership checks, and visual/design-sync checks required by CI.

For this audit-only change, no runtime behaviour has been changed. The deliverable is this reviewed ownership map and risk record.

## Decision summary

- Keep Spartan Helm Button as the button foundation.
- Keep native file and image semantics where they are the correct platform primitives.
- Move the visible file-selection trigger to real semantic control ownership.
- Do not keep the hand-rolled crop box as a second permanent crop primitive.
- Converge uploader cropping with the repository's approved cover-photo crop capability.
- Keep upload/network state in feature logic, outside Spartan primitives.
- Treat keyboard crop operation, focus management, translated image copy, and async status communication as required migration criteria, not optional polish.
