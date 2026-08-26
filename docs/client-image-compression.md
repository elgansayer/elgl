# Client image compression before upload

Issue: #1723

## Contract

All browser image uploads that use `ImageCompressionService` are re-encoded as JPEG before network upload. The service applies a hard 1080p ceiling regardless of a caller requesting a larger derivative:

- landscape sources fit inside 1920×1080;
- portrait sources fit inside 1080×1920;
- smaller images are never upscaled;
- caller-provided width/height limits may make the output smaller, but never larger than the hard ceiling.

The current avatar upload path and chat photo upload path both use this shared service before sending image bytes. Chat can continue to express Standard/HD JPEG quality and requested derivative size, but the shared privacy/performance boundary is authoritative and caps both modes at 1080p.

JPEG, PNG and WebP are accepted raster inputs. Other `image/*` formats, including SVG, are rejected rather than decoded into the upload pipeline. Non-image inputs are returned unchanged so callers that share the utility with other media types do not have their payload rewritten.

## Failure and abuse handling

Compression is fail-closed for images. If the browser cannot create a 2D canvas, cannot draw the decoded image, or cannot produce non-empty JPEG bytes, the upload caller receives an error and the original full-resolution image is **not** silently uploaded.

Decoded dimensions must be positive and are bounded to 100 megapixels before canvas allocation. This is a client-side resource guard against pathological source dimensions; the server-side upload MIME/size policies remain independently authoritative.

Width, height and JPEG quality options are validated before the source object URL is created. Image decode failures return stable errors without including filenames, image content or browser/provider internals.

## Privacy

Canvas re-encoding strips source-container metadata such as EXIF/GPS metadata from uploaded JPEG bytes. The service does not log filenames, source dimensions, object URLs or image contents. Temporary blob URLs are revoked after successful decode and after decode/setup failures.

This is a transport-preparation boundary, not an authorization boundary. R2 presigning, authenticated ownership and server-side MIME/byte limits remain mandatory.

## Verification

Focused Vitest coverage in `frontend/src/app/services/image-compression.service.spec.ts` verifies:

- non-image pass-through and raster format validation;
- landscape and portrait 1080p ceilings even when a caller asks for 2560px output;
- no upscaling;
- stable JPEG naming/type and last-modified preservation;
- fail-closed canvas and encoder behavior;
- invalid option rejection before decoding;
- pathological decoded-dimension rejection before canvas allocation; and
- temporary object URL cleanup on success and decode failure.

Run locally with:

```bash
cd frontend
npm test -- image-compression.service.spec.ts chat-media.service.spec.ts
npm run build
```

GitHub Actions remains the authoritative clean-environment verification for the broader frontend suite, build, lint/static analysis and product contracts.

## Rollout and rollback

No database or API migration is required. Deploy the frontend normally. Existing server upload contracts remain compatible because the output is still `image/jpeg` and is no larger than previously requested client derivatives.

During rollout, smoke-test a large landscape JPEG, a large portrait PNG, a small WebP, an unsupported SVG and a browser with canvas encoding disabled. The first three should upload as bounded JPEGs; the latter two should fail before any image bytes are sent.

Rollback is a frontend code revert only. Do not roll back by restoring the previous silent fallback that uploaded the original image when compression failed, because that bypasses the documented resolution/privacy boundary.
