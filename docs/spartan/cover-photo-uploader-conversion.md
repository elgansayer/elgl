# Cover photo uploader Spartan conversion

Issue: #6077

Target: `frontend/src/app/components/cover-photo-uploader`

## Result

`CoverPhotoUploaderComponent` now owns only product composition and the cover upload sequence. Browser-native and Spartan-owned interaction semantics are used instead of recreating them in feature code:

- the hidden file picker remains the native file input;
- the visible Add/Change cover action is a real native button enhanced by `hlmBtn`, rather than a focusable `div` plus a custom keyboard directive;
- Crop, Upload, and Cancel remain Spartan Helm buttons;
- crop manipulation is delegated to the existing `CoverPhotoCropperComponent`, which is the repository's shared 3:1 `ngx-image-cropper` adapter;
- images remain native `<img>` elements with translated alternative text;
- upload progress and failure are exposed with `aria-busy`, a polite status region, and an alert state.

This removes the uploader's duplicate SVG mask, custom mouse/touch drag listeners, resize handles, crop-coordinate math, and canvas crop engine. The feature no longer maintains a second pointer-only crop implementation beside `CoverPhotoCropperComponent`.

## Behaviour preserved

The product flow remains:

1. Select a JPEG, PNG, or WebP file.
2. Review the selected image.
3. Open the 3:1 cover cropper.
4. Save the crop and review its local preview.
5. Upload the cropped blob.
6. Emit `coverPhotoUploaded` only after the backend confirms the object and returns the authoritative cover URL.

Canceling the cropper keeps the selected source. Canceling the uploader clears local editor state. Upload is disabled until a valid crop exists, rather than accepting a click and silently doing nothing.

## API and security boundary

The uploader retains the existing authenticated direct-upload sequence:

1. `POST /media/cover/presigned-url`
2. browser `PUT` to the returned short-lived R2 upload URL
3. `POST /media/cover/confirm`

The browser never receives Cloudflare service credentials. The request uses the DTO-valid `cover-photos` folder value; the backend remains authoritative and rewrites the actual object prefix to the user-scoped `covers/<user>/...` path.

Only JPEG, PNG, and WebP are accepted locally. The backend independently validates the media content type before signing and again when confirming the uploaded object.

No schema, route, authentication, or persistence contract changes are introduced.

## Failure and concurrency behaviour

- A second Upload click is ignored while an upload is active.
- Crop and full-editor Cancel actions are disabled while upload is active, avoiding local state races with the in-flight confirmation.
- Presign, R2 PUT, and confirmation failures leave the cropped blob and preview intact so the user can retry.
- Failure state is shown in the uploader without logging upload URLs, object keys, provider responses, or image data.
- Generated object-preview URLs are revoked when replaced, reset, or destroyed.
- A malformed/empty crop result is rejected before upload state changes.

## Accessibility and responsive behaviour

The Add/Change cover action now receives browser-native Enter/Space activation and focus semantics from `<button>`. The existing Relay focus-visible treatment is preserved. The cropper owns keyboard/focus/dialog behaviour instead of exposing unlabeled 12px resize-handle divs.

Editing actions retain `size="touch"`, stack at the mobile baseline, and wrap into a row on wider screens. Product-authored image alternative text uses the existing `coverPhoto.previewAlt` translation key. RTL affects product layout only; image pixels and crop coordinates are not mirrored by the uploader.

The visual surface intentionally keeps the existing Relay semantic tokens and layout, so this interaction-ownership change does not introduce a new design-preview contract. The dedicated cropper remains responsible for its own Relay/theme preview coverage.

## Verification

Focused regression coverage in `cover-photo-uploader.component.spec.ts` verifies:

- native Spartan file-trigger ownership;
- translated image labelling;
- accepted/rejected file selection;
- delegation to `CoverPhotoCropperComponent`;
- valid crop preview state;
- upload gating before a crop exists;
- the presign -> R2 PUT -> confirm -> output sequence;
- the DTO-valid presign folder and generated WebP filename;
- recoverable upload failure state;
- object-URL cleanup on reset.

Repository CI remains authoritative for frontend unit tests, static analysis, production build, Spartan ownership checks, translation safety, and design governance.

## Rollout and rollback

No migration or configuration change is required. Deploy as a normal frontend release against the existing media API.

Rollback is a normal revert of the #6077 implementation commits. No cover rows or R2 objects need rewriting. Existing confirmed cover URLs remain valid.
