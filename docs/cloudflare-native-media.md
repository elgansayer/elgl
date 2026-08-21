# Cloudflare-native media architecture

## Decision

All application media storage and live-room recording use Cloudflare-native services and repository-owned protocol boundaries.

```text
Browser upload
  -> Nest authenticated upload intent
  -> HMAC-signed Cloudflare Worker URL
  -> Worker native R2 binding
  -> Nest finalisation and product record

Backend object operation
  -> Worker service token
  -> Worker native R2 binding

LiveKit room recording
  -> RoomComposite RTMPS output
  -> Cloudflare Stream live input
  -> automatic Stream recording
  -> audio-only M4A when transcription is needed
```

Application code must not use an AWS service, AWS SDK, S3 client, S3-specific egress adapter, AWS endpoint, AWS credential variable or R2 access-key compatibility setting.

The repository enforces that decision through `scripts/verify-no-aws-sdk.mjs`.

## Components

### Cloudflare R2 gateway Worker

Path: `workers/r2-gateway/`

Responsibilities:

- verify versioned HMAC upload signatures;
- enforce expiry, method, exact key, content type and byte ceiling;
- enforce browser-origin CORS policy;
- stream uploads into a native `R2Bucket` binding;
- provide authenticated backend read, metadata and delete operations;
- expose native R2 multipart create, part, complete and abort operations;
- return bounded safe errors and object metadata.

The Worker does not decide product ownership, entitlement, visibility or asset readiness. Nest and Supabase own those decisions.

### Nest Cloudflare R2 module

Path: `backend/src/cloudflare-r2/`

Responsibilities:

- generate server-owned object keys;
- sign browser upload contracts;
- authenticate management requests to the Worker;
- validate source URLs before server-side ingestion;
- reject private/local and non-allowlisted source hosts;
- revalidate redirects;
- enforce timeout and byte limits;
- normalize Worker errors into a typed backend boundary.

### Cloudflare Stream recording provider

Path: `backend/src/cloudflare-stream/`

Responsibilities:

- create a short-lived Stream live input through a least-privilege API token;
- configure automatic recording and bounded retention;
- provide the RTMPS ingest URL to LiveKit Egress;
- poll for the completed recording with bounded timeout;
- request and poll an audio-only M4A for transcription;
- delete the temporary live input;
- return truthful unavailable/failure state rather than a simulated recording.

### Existing media service

Path: `backend/src/media/`

Responsibilities after migration:

- validate purpose-specific content-type policy before issuing an upload URL;
- use the R2 gateway for avatar, cover, voice-note and image operations;
- run current bounded image/audio transforms;
- update product records only after the Cloudflare operation succeeds;
- never create a fallback media URL after failure.

The full persisted asset state machine, byte verification and durable derivatives remain tracked by #7468.

## Secrets and separation

Use distinct secrets:

| Secret | Consumer | Purpose |
|---|---|---|
| `UPLOAD_SIGNING_SECRET` | Worker | Verify browser upload signatures |
| `CLOUDFLARE_R2_SIGNING_SECRET` | Nest | Produce browser upload signatures |
| `SERVICE_TOKEN` | Worker | Authenticate backend management operations |
| `CLOUDFLARE_R2_SERVICE_TOKEN` | Nest | Call backend management operations |
| `CLOUDFLARE_STREAM_API_TOKEN` | Nest | Create, read and delete Stream inputs/recordings |
| `CLOUDFLARE_API_TOKEN` | Existing CDN/cache integration | Separate non-Stream Cloudflare operations |

The paired Worker/Nest values must match, but each pair remains independent from the other pair.

Do not:

- reuse secrets between upload signing and backend management;
- expose either secret to Angular;
- put secrets in object keys, query logs, test fixtures or GitHub comments;
- grant a broad Cloudflare account token when a least-privilege Stream token is sufficient;
- mount a general Cloudflare credential directory into application containers.

## Browser upload flow

1. Angular asks Nest for an upload intent for a specific purpose.
2. Nest authenticates the user and applies purpose, quota and size/type policy.
3. Nest chooses the exact R2 key and maximum bytes.
4. Nest returns the signed Worker URL and operation metadata.
5. Angular uploads directly to the Worker.
6. The Worker validates the signature, origin and streaming size and writes through the R2 binding.
7. Angular calls Nest finalisation with stable operation/asset identifiers.
8. Nest verifies the object and moves the asset through verification and processing.
9. Product records reference the asset ID only when policy permits.

The current compatibility APIs may still return a public URL for existing feature contracts. #7468 replaces that transitional representation with authoritative asset records.

## Multipart flow

1. Nest creates an upload intent and asks the Worker to create a native R2 multipart upload.
2. Nest signs one URL per part, bound to object key, upload ID, part number, byte ceiling and expiry.
3. Angular uploads parts with bounded concurrency and records returned ETags.
4. Nest or the authorized client submits the ordered part list through the authenticated completion boundary.
5. The Worker completes the native R2 multipart upload and returns object metadata.
6. Nest finalises and verifies the asset.
7. Cancellation, expiry and abandoned sessions call abort or durable cleanup.

No AWS-named client plugin or S3 multipart API is part of the application contract.

## Live-room recording flow

1. Nest creates a temporary Cloudflare Stream live input with automatic recording.
2. The Stream API returns an RTMPS ingest URL and key.
3. LiveKit RoomComposite Egress publishes to that RTMPS URL.
4. When the room ends, Nest stops the LiveKit egress.
5. Nest waits for Cloudflare Stream to report a ready recording.
6. When transcription is required, Nest requests an audio-only M4A and waits for readiness.
7. Azure Speech receives the authoritative audio URL.
8. Nest deletes the temporary live input and relies on the configured recording retention.
9. Missing provider configuration or failure returns no transcript; no simulated recording or transcript is produced.

The temporary in-memory room-to-egress mapping is an explicit compatibility boundary. #7448 moves active recording and recovery state into durable jobs/state.

## Configuration

### R2 gateway backend settings

```text
CLOUDFLARE_R2_GATEWAY_URL
CLOUDFLARE_R2_SIGNING_SECRET
CLOUDFLARE_R2_SERVICE_TOKEN
CLOUDFLARE_R2_PUBLIC_URL
CLOUDFLARE_R2_SOURCE_HOSTS
CLOUDFLARE_R2_UPLOAD_TTL_SECONDS
CLOUDFLARE_R2_MAX_SINGLE_UPLOAD_BYTES
CLOUDFLARE_R2_MAX_MULTIPART_PART_BYTES
CLOUDFLARE_R2_SOURCE_FETCH_TIMEOUT_MS
```

### Stream backend settings

```text
CLOUDFLARE_STREAM_ACCOUNT_ID
CLOUDFLARE_STREAM_API_TOKEN
CLOUDFLARE_STREAM_ALLOWED_ORIGINS
CLOUDFLARE_STREAM_POLL_INTERVAL_MS
CLOUDFLARE_STREAM_RECORDING_TIMEOUT_MS
CLOUDFLARE_STREAM_DELETE_RECORDING_AFTER_DAYS
```

### Transcription settings

```text
AZURE_SPEECH_KEY
AZURE_SPEECH_REGION
AZURE_SPEECH_TRANSCRIPTION_TIMEOUT_MS
```

Startup validation rejects weak or invalid values and provides safe development/test defaults. Production deployment must supply real secrets through the deployment secret store.

## Security model

### Upload authorization

A signed upload URL proves only that Nest approved one bounded transfer. It does not prove:

- the object bytes are safe;
- the asset is ready;
- the user may publish or share it indefinitely;
- a later viewer may access it;
- the original declaration matches the bytes.

Finalisation and reference operations remain server-authoritative.

### Source URL ingestion

Server-side URL ingestion:

- accepts HTTP or HTTPS only;
- rejects credentials in the URL;
- rejects loopback, private and local hostnames/IPs;
- requires a configured source-host allowlist when used;
- manually handles and revalidates redirects;
- applies timeout and maximum byte limits;
- validates the returned content type;
- rejects empty responses.

DNS-resolution and network egress controls should provide an additional production layer. The application checks are not a substitute for network policy.

### Content validation

The Worker enforces transfer constraints, not media safety.

Before READY/publication, durable processors must verify actual bytes through:

- Sharp for images;
- pinned ffprobe/FFmpeg for audio/video;
- a separate document/archive scanner policy;
- explicit rejection or isolation for SVG, HTML and executable formats.

### Delivery

Private media must not rely on obscurity of an R2 URL. Use authenticated or short-lived repository-signed delivery and recheck visibility/ownership.

## Verification

Run:

```bash
npm run check:no-aws-sdk
npm run test:r2-gateway
cd backend
npm run lint:check
npm run build
npx vitest run \
  src/cloudflare-r2/r2.service.spec.ts \
  src/cloudflare-r2/r2-object.service.spec.ts \
  src/cloudflare-stream/cloudflare-stream.service.spec.ts \
  src/media/media.service.spec.ts \
  src/config/validation.schema.spec.ts
```

The no-AWS check scans source, manifests, lockfiles and environment examples.

## Deployment sequence

1. Create preview R2 bucket and preview Worker binding.
2. Configure preview origins, public URL and ceilings.
3. Set independent Worker signing and service secrets.
4. Deploy and run signed PUT, multipart and management smoke tests.
5. Configure backend preview settings and run application media flows.
6. Create a least-privilege Stream token and test a short LiveKit room recording.
7. Verify audio-only generation and transcription without private production media.
8. Review metrics, errors and cleanup.
9. Repeat for production with independently generated secrets.
10. Deploy backend after Worker and Stream configuration are ready.
11. Remove old access-key variables and verify the no-AWS guard in deployment source/configuration.

## Recovery

### R2 gateway outage

- stop or fail new intent issuance truthfully;
- retain local drafts;
- do not send messages or update profiles with a fake URL;
- deploy the previous Worker release or restore Cloudflare service;
- reconcile uploaded/unfinalised objects.

### Stream outage

- room participation continues when recording is optional;
- recording state reports unavailable/failure;
- do not substitute an object-storage or AWS egress;
- retry only through the documented durable policy;
- preserve audit/correlation without media content or ingest keys.

### Processing backlog

- keep assets in VERIFYING or PROCESSING;
- expose queue age and retry/operator actions;
- do not mark partial derivatives READY;
- scale or repair BullMQ workers;
- use #3503 dead-letter recovery for exhausted jobs.

### Rollback

Rollback to the previous known-good Cloudflare Worker/backend deployment while preserving operation IDs and unfinalised objects for reconciliation.

A rollback must not restore:

- an AWS SDK or service;
- an S3-specific application adapter;
- access-key compatibility;
- browser bucket credentials;
- a fictional URL, recording or transcript;
- weakened object ownership or visibility policy.

## Follow-on work

- #7468: persisted assets, finalisation, native multipart Angular client and durable derivatives;
- #7467: shared recorded-audio capture, drafts, probing, transcode and playback;
- #7466: shared LiveKit media-session/device/track lifecycle;
- #7448: durable recording and processing jobs;
- #7449: authoritative asset schema, RLS and generated types;
- #7450: local media drafts and outbox;
- #7455: bounded traces and metrics;
- #7464: truthful failure states;
- #3503: dead-letter recovery.
