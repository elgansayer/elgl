# Profile cover photo upload and positioning

Issue #1230 is implemented by the existing profile cover-photo path. This document records the contract that the product and regression tests must preserve.

## Product flow

`ProfileComponent` renders `CoverPhotoUploaderComponent` with the current `cover_photo_url`. A learner can select a JPEG, PNG, or WebP image, position a 3:1 crop, preview the cropped result, and upload it. The component emits the confirmed cover URL back to the profile so the visible profile state updates without a page reload.

The initial crop is centred and remains inside the source image. Wide and short images both preserve the 3:1 cover aspect ratio. The crop UI is local browser state until the learner explicitly uploads the result.

## Upload boundary

The browser does not receive Cloudflare credentials. The normal flow is:

1. `POST /media/cover/presigned-url` requests a short-lived upload URL for a JPEG cover object.
2. The browser uploads the cropped blob directly to that signed URL with `PUT`.
3. `POST /media/cover/confirm` confirms the object key and returns the authoritative `coverUrl`.
4. Only a successful confirmation emits `coverPhotoUploaded` to the profile UI.

Both backend endpoints are protected by `SupabaseAuthGuard`. The backend derives authorization from the authenticated user rather than trusting a user identifier supplied by the browser.

A failed direct upload must not emit or persist a fictional cover URL. The selected/cropped preview remains available so the learner can retry or cancel.

## Privacy and security

Cover images are user-provided media. Do not log image bytes, signed upload URLs, object credentials, authentication tokens, or raw provider error payloads. The signed upload path is the credential boundary; application code must not expose R2 service credentials to the browser.

The crop operation is performed locally and does not send the original image to an application API before the learner chooses Upload.

## Accessibility and responsive behaviour

The cover surface must remain usable with keyboard, touch, light/dark themes, RTL layouts, and high zoom. Existing Spartan touch-sized actions own Crop, Apply Crop, Cancel, and Upload interaction semantics. Relay surface tokens own card, border, elevation, and theme presentation.

Future UI migrations must preserve the functional 3:1 positioning contract and the authenticated presign -> direct upload -> confirm sequence.

## Verification

The component regression suites cover:

- centred 3:1 positioning for normal and short source images;
- Relay/Spartan responsive presentation;
- file-selection state and reset behaviour;
- successful presign -> R2 PUT -> confirm sequencing;
- emitted authoritative cover URL after confirmation;
- failure-safe direct upload with no false success.

Run the repository frontend unit, static-analysis, production-build, design-governance, dependency-review, and relevant UI checks before merge.

## Rollout and rollback

No schema migration is required for this contract. The existing `cover_photo_url` profile field and authenticated media endpoints remain authoritative. Rollback is a normal application revert; existing stored cover objects and profile URLs require no data rewrite.
