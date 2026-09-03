# Media pre-signed uploads

The media API exposes authenticated, server-scoped pre-signed upload URLs for profile avatars, audio introductions, and cover images.

## Endpoints

All endpoints require a valid Supabase access token.

### Avatar

`POST /media/avatar/presigned-url`

Request body:

```json
{
  "filename": "avatar.webp",
  "contentType": "image/webp"
}
```

Supported content types are `image/jpeg`, `image/png`, and `image/webp`.

The server creates the object key under `avatars/<authenticated-user-id>/...`. Clients cannot select the storage folder or another user's prefix.

### Audio introduction

`POST /media/audio-intro/presigned-url`

Request body:

```json
{
  "filename": "intro.m4a",
  "contentType": "audio/mp4"
}
```

Supported content types are `audio/mpeg`, `audio/mp4`, `audio/webm`, `audio/ogg`, `audio/wav`, `audio/aac`, and `audio/x-m4a`.

The server creates the object key under `audio-intros/<authenticated-user-id>/...`.

### Response

Both endpoints return:

```json
{
  "uploadUrl": "https://...",
  "mediaUrl": "https://...",
  "objectKey": "avatars/user-id/..."
}
```

The client uploads the bytes to `uploadUrl` with the same `Content-Type` used in the request. `mediaUrl` is the public URL associated with the generated object key.

## R2 architecture

`MediaModule` imports `CloudflareR2Module`. The current repository deliberately centralizes Cloudflare R2 credentials and S3-compatible signing behind the existing R2 gateway rather than creating a second `@aws-sdk/client-s3` credential path inside `MediaModule`. `MediaService` asks `R2ObjectService` for upload URLs, and `R2ObjectService` delegates signing and size enforcement to `R2Service`/the gateway.

This preserves the intent of issue #952 while keeping one storage security boundary and one configuration surface.

## Security and validation

- Authentication determines the user ID embedded in the object prefix.
- Dedicated endpoints determine the folder server-side.
- Unsupported MIME types are rejected before an upload URL is issued.
- Filenames are used only to derive a sanitized extension; random object names prevent caller-controlled object keys.
- The R2 gateway applies the configured single-upload size limit.
- R2 credentials and service tokens are never returned to the client.

## Verification

Backend coverage verifies that:

- avatar requests call the dedicated avatar pre-sign service path;
- audio-intro requests call the dedicated audio pre-sign service path;
- generated keys remain inside the authenticated user's expected prefix;
- supported MIME types reach the R2 URL generator; and
- unsupported avatar/audio MIME types are rejected before signing.

Run the media tests with the backend test command targeting `src/media/media.controller.spec.ts` and `src/media/media.service.spec.ts`, or rely on the canonical repository CI workflow.

## Rollout and rollback

No database migration is required. Deploy the backend normally; existing cover and multipart upload endpoints remain unchanged.

Rollback is a normal application-code revert. Removing these two routes does not invalidate already-uploaded objects and does not require R2 or database cleanup.
