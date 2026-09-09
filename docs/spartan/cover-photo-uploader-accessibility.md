# Cover photo uploader accessibility pass

Issue: #6079

Target: `frontend/src/app/components/cover-photo-uploader`

## Scope

This pass completes the uploader-specific keyboard, screen-reader, RTL, touch, reduced-motion and high-zoom contract after the Spartan conversion in #6077. The shared `CoverPhotoCropperComponent` continues to own the crop-dialog interaction itself; this document covers the uploader's composition before and after that dialog is invoked.

No API, schema, authentication, storage, image-coordinate or upload-order contract changes are introduced.

## Keyboard and focus contract

The visible Add/Change cover control remains a native `button[hlmBtn]`, so browser Enter and Space behaviour is authoritative and no feature-level keyboard emulation is required.

Mode changes now have deterministic focus destinations:

- after a valid selected file is decoded and the editor replaces the file-selection surface, focus moves to **Crop**;
- resetting or abandoning the editor moves focus back to the Add/Change cover trigger;
- a rejected local file returns focus to the still-available file trigger;
- an upload failure retains the crop and returns focus to **Upload** so retry is immediate;
- opening/closing the actual crop dialog remains the responsibility of the shared cropper/Spartan dialog boundary.

Focus is scheduled with Angular `afterNextRender`, so it targets the control that exists in the new rendered state rather than a node that is being removed. The callback is SSR-safe because Angular render callbacks do not run during server rendering.

## Screen-reader and failure contract

The existing translated `coverPhoto.previewAlt` remains the accessible image description for current, selected and cropped cover previews.

Upload progress stays in the editor's polite atomic status region and is also exposed through `aria-busy` on the Upload action. Local file rejection and file-read failure now render the same translated `common.error` alert in file-selection mode, while upload failures retain the existing alert inside editor mode. Failures therefore remain perceivable without reserving new layout space during the normal idle state. Provider responses, upload URLs, object keys and image data are not exposed in the message.

The native file input is cleared after a rejected/read-failed file and on reset. This preserves the ability to select the same file again after a recoverable failure or cancellation.

## Touch, zoom and reflow

All visible actions continue to use the repository-owned Spartan `size="touch"` contract (minimum 44 CSS pixels). The editor remains mobile-first and stacks actions at the narrow baseline before allowing a wrapped row on wider viewports.

Feature-level button classes explicitly allow translated labels to wrap (`whitespace-normal`, `break-words`, `max-w-full`) instead of inheriting Spartan's normal single-line button presentation. The outer composition and action row use `min-w-0`, so long translations at 200%/400% zoom can reflow without forcing horizontal overflow or hiding actions.

The cover image itself remains responsive and scrolls with the document; no fixed-position action bar or clipped viewport is introduced.

## RTL and bidirectional content

No physical left/right margin or positioning utility is introduced for uploader controls. Flex layout follows document direction while the upload sequence and DOM focus order remain stable.

RTL affects product chrome only. Image pixels, crop coordinates and the 3:1 crop result are not mirrored by the uploader. The shared cropper remains authoritative for crop-coordinate behaviour.

## Reduced motion

The Add/Change cover overlay keeps its existing opacity transition for pointer/focus presentation, but adds `motion-reduce:transition-none` so users requesting reduced motion do not receive that transition. No new animation is introduced for mode changes, progress or errors.

## Security and privacy

The existing direct-upload boundary is unchanged:

1. authenticated `POST /media/cover/presigned-url`;
2. browser `PUT` to the short-lived user-scoped R2 URL;
3. authenticated `POST /media/cover/confirm`;
4. emit `coverPhotoUploaded` only after authoritative confirmation.

Only JPEG, PNG and WebP are accepted locally, with backend validation remaining authoritative. Accessibility feedback contains only translated generic product copy and does not log or render credentials, signed URLs, object keys, provider errors or image contents.

## Verification

Focused Angular regression coverage now locks:

- native button semantics without synthetic `role`, `tabindex` or key handlers;
- visible focus and reduced-motion classes on the file trigger;
- translated cover alternative text;
- focus transfer from file selection to Crop;
- accessible rejection of unsupported local files and picker recovery;
- delegation to the shared cropper;
- 44px touch ownership and long-copy/high-zoom wrapping for editor actions;
- upload gating and the existing presign -> R2 PUT -> confirm sequence;
- retryable upload failures with error announcement and focus returned to Upload;
- reset focus restoration and object-URL cleanup;
- polite atomic upload-status semantics.

Repository CI remains authoritative for frontend unit tests, static analysis, production build, RTL/logical-layout checks, Spartan ownership, translation safety, screen-reader naming, touch-target sizing, high-zoom/reflow governance and design-sync validation.

## Design sync

This pass does not introduce a new component composition or product visual state. It reuses the existing Relay surfaces, existing error presentation and existing mobile/wide action layouts. The only presentation changes are wrap/reflow safety and reduced-motion behaviour, so the existing `spartan.component-system` preview remains authoritative. The manifest reconciliation metadata is updated for this implementation pass without adding a duplicate preview.

## Rollout and rollback

Deploy as a normal frontend release. There is no migration, feature flag or persisted-state transition.

Rollback is a direct revert of the #6079 commits. Existing uploaded cover URLs and R2 objects remain valid. If rollback occurs after a client has selected a file, only local transient editor state is affected; no server cleanup is required.
