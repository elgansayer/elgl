# Media and interaction platform roadmap

**Programme tracker:** #7463  
**Capability atlas:** [`feature-capability-modernisation-atlas-2026-08.md`](./feature-capability-modernisation-atlas-2026-08.md)  
**Core issues:** #7464 through #7479  

## Objective

Converge the repository's drawing, recorded audio, calls, screen sharing, uploads, media processing, motion, tours, emoji and loading feedback on maintained infrastructure with one application-owned contract per concern.

The target architecture is:

```text
User interaction
  |
  +--> message doodle ----------> vector document / perfect-freehand
  |
  +--> recorded audio ----------> MediaRecorder / local draft
  |
  +--> live call/share ---------> LiveKit media session
  |
  +--> file/image/video --------> upload intent / direct R2 transfer
  |
  +--> animation ---------------> CSS / View Transition / governed asset
  |
  +--> tour/emoji/loading ------> shared Relay/Spartan product primitive
  |
  v
Generated API client
  |
  v
Nest policy and asset services
  |
  +--> Supabase metadata, RLS and product records
  +--> R2 original/derivative objects
  +--> BullMQ verification/transcode/derivative jobs
  +--> OpenTelemetry/Pino diagnostics
```

## Non-negotiable boundaries

1. **LiveKit owns realtime media transport.** Do not build custom WebRTC or add another SFU.
2. **R2 owns object storage.** Do not replace it to gain an upload widget.
3. **Supabase owns durable asset metadata and authorization.** A public URL is not the asset identity.
4. **BullMQ owns durable processing.** API requests do not perform unbounded audio/video/image work synchronously.
5. **Dexie owns offline drafts/outbox.** Feature components do not open their own IndexedDB databases.
6. **Relay/Spartan owns product UI.** Package UIs remain optional implementation details behind adapters.
7. **Failure is truthful.** No synthetic uploaded URL, fictional media record, false completion or source-as-result fallback.
8. **Media bytes are untrusted.** Browser MIME, extension, dimensions, duration and metadata are hints only.
9. **Accessibility is not supplied by a canvas/waveform/map/animation.** Semantic controls and equivalent representations are required.
10. **Every trial has an exit.** One package is adopted behind an adapter or all trial packages are removed.

## Current-state findings

### Doodle pad

The existing doodle pad uses a fixed 600 by 400 bitmap canvas, separate mouse/touch event handling and data URL export. It has no durable stroke document, pressure, undo/redo, responsive high-DPI model or collaborative architecture.

### Live media

LiveKit is already integrated and screen sharing uses LiveKit publication semantics. Room creation, token fetching, device handling, track attachment, audio element creation, state and teardown are duplicated across services/components.

### Recorded audio

Several components construct their own MediaRecorder flow. Requested filename/format can disagree with the actual captured bytes. Upload failure can be converted into a synthetic URL. There is no single canonical server probe/transcode and waveform metadata path.

### Uploads and media processing

R2/AWS SDK and Sharp already exist. Transfer and finalisation are feature-specific. Large assets can flow through API buffering. Server-side asset readiness, byte verification, quarantine and derivative state are not one coherent lifecycle.

### Motion

The app combines deprecated Angular animation registration, CSS/Tailwind motion, direct `lottie-web`, an apparently unused `ngx-lottie`, and feature-specific celebration/loading lifecycle. No shared-element/hero route policy exists.

### Product primitives

Tours use both Joyride and custom engines. Emoji data is embedded manually. Loading feedback mixes skeleton package, custom spinners and ambiguous loading/empty/failure states.

## Target domain model

### Asset

```ts
interface MediaAsset {
  id: string;
  ownerId: string;
  purpose: MediaPurpose;
  privacy: MediaPrivacy;
  state: MediaAssetState;
  originalStorageKey?: string;
  verifiedMediaType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  createdAt: string;
  readyAt?: string;
  failureCode?: MediaFailureCode;
  version: number;
}
```

The exact generated type comes from the Supabase/OpenAPI authority. The important invariant is that feature records reference an asset ID and policy, not a caller-supplied URL.

### Asset states

```text
DRAFT
UPLOAD_INTENT_CREATED
UPLOADING
UPLOADED_UNVERIFIED
VERIFYING
PROCESSING
READY
FAILED_RETRYABLE
FAILED_PERMANENT
QUARANTINED
EXPIRED
DELETED
```

Only READY assets, or explicitly approved processing placeholders, may be published to other users.

### Local draft

```ts
interface MediaDraft {
  id: string;
  userId: string;
  purpose: MediaPurpose;
  localBlob: Blob;
  actualMimeType: string;
  createdAt: string;
  operationId: string;
  state: MediaDraftState;
  uploadId?: string;
  assetId?: string;
}
```

Drafts are per-user, bounded and purged on security lifecycle events.

### Media session

```ts
type MediaSessionState =
  | 'idle'
  | 'requesting-token'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'disconnecting'
  | 'ended'
  | 'failed';
```

Feature components consume state and commands. They do not directly own a second room/listener/attachment lifecycle.

### Doodle document

```ts
interface DoodleDocumentV1 {
  version: 1;
  logicalWidth: number;
  logicalHeight: number;
  background: DoodleBackground;
  strokes: DoodleStroke[];
  createdAt: string;
}
```

Render/export is derived from normalized vector source.

## Platform modules

The final location should follow #7452 workspace decisions. Logical ownership should resemble:

```text
libs/media-contracts/
  asset.ts
  upload.ts
  audio.ts
  doodle.ts
  session.ts

libs/media-client/
  media-upload.service.ts
  media-draft.repository.ts
  audio-capture.service.ts
  audio-playback.service.ts
  doodle-engine.ts
  livekit-media-session.ts
  track-attachment.directive.ts

libs/ui/
  media-recorder/
  audio-player/
  upload-progress/
  media-processing-status/
  doodle-toolbar/
  call-controls/
  participant-tile/
  animated-illustration/
  loading-status/

backend/src/media-platform/
  asset.service.ts
  upload-intent.service.ts
  finalisation.service.ts
  policy.service.ts
  delivery.service.ts
  processors/
  providers/

backend/src/jobs/media/
  verify-image.processor.ts
  audio-transcode.processor.ts
  video-derivative.processor.ts
  waveform.processor.ts
  cleanup.processor.ts
```

Do not create all directories before the first reference implementation proves the boundaries.

## Workstream A: truthful failure and state

**Issues:** #7464, #7447, #7456, #7479

### Required first changes

- remove fake uploaded URLs and ordinary success events after upload failure;
- distinguish empty, stale, unavailable and failed responses;
- define typed media draft and asset states;
- keep unsent user data locally with retry/discard rather than pretending publication;
- expose durable server processing state instead of indefinite spinner;
- add safe correlation IDs.

### Gate A

No later media migration may merge if it still needs a fake URL/content record to keep its screen working.

## Workstream B: asset and upload foundation

**Issue:** #7468

### Reference implementation

Use avatar or cover-photo upload first because it covers:

- file input and crop preview;
- small direct upload;
- ownership and purpose validation;
- server byte verification;
- Sharp derivative;
- asset finalisation;
- private/public delivery choice;
- replacement/deletion;
- accessible progress/error states.

### PR sequence

1. Asset schema, state enum, purpose/privacy policy and generated types.
2. Authenticated single-part upload intent and finalisation.
3. Browser upload facade and cover/avatar reference flow.
4. Sharp verification/derivative worker and READY transition.
5. Multipart intent/progress/resume trial with Uppy for large assets.
6. Delivery URL resolution and legacy URL reader.
7. Orphan, abandoned multipart, expiry and deletion jobs.
8. Remaining feature migrations.

### Transfer decision

Use single-part direct upload for small files. Use multipart above a measured threshold. Do not make every asset multipart for architectural uniformity.

### Uppy trial gate

Retain Uppy Core/AWS S3 only if all pass:

- R2 compatibility and multipart resume;
- SSR/browser-only isolation;
- product-owned UI integration;
- keyboard/screen-reader/mobile behaviour;
- acceptable lazy bundle and memory;
- cancellation and refresh recovery;
- no package types outside the adapter.

## Workstream C: recorded audio

**Issue:** #7467

### Capture format policy

The client probes actual support through `MediaRecorder.isTypeSupported` and stores the actual Blob MIME.

A possible candidate order is product/browser dependent, but the rule is stable:

```text
select supported recorder MIME
record bytes
preserve actual MIME/container
upload original
server probes bytes
server emits canonical delivery variants
```

The file extension is derived from verified output, not a requested dropdown value.

### Reference flow

Migrate chat voice notes first:

1. permission rationale and browser prompt;
2. recording state/pause/stop/cancel;
3. local draft review;
4. direct upload and server processing;
5. ready-to-send asset reference;
6. recipient playback and waveform;
7. offline/retry/duplicate finalisation;
8. moderation/deletion.

### Server processing

- pin FFmpeg/ffprobe in the worker image;
- use argument arrays, no shell interpolation;
- limit wall time, memory, CPU, input bytes, streams and duration;
- validate container/codec from bytes;
- output canonical formats selected from browser tests;
- generate duration and waveform peaks;
- make processors idempotent;
- never mark partial output READY.

### WaveSurfer trial gate

Use WaveSurfer only as a visual/interaction enhancement. Retain it when:

- server peaks avoid full decode for long files;
- low-end mobile performance is acceptable;
- player remains semantic without waveform perception;
- seek/regions/record visualization provide real product value;
- cleanup does not leak AudioContext/listeners/DOM;
- lazy bundle is acceptable.

## Workstream D: LiveKit media session

**Issue:** #7466

### Keep LiveKit

LiveKit owns room connectivity, publications and screen-share source. Do not add another WebRTC abstraction that recreates transport.

### Reference flow

Migrate direct video call first:

1. token/session API;
2. media-session state;
3. device/permission prejoin;
4. connect/reconnect/disconnect;
5. mic/camera/share commands;
6. track attachment registry;
7. autoplay/start-audio handling;
8. route teardown and repeated join/leave tests.

### Screen sharing

- publish through `setScreenShareEnabled`;
- synchronize UI when browser ends capture;
- represent screen video and optional system/tab audio separately;
- apply backend role/grant policy;
- define multiple-share/presenter takeover;
- include share tracks in remote layout and recording policy;
- use immediate reduced-motion layout changes where appropriate.

### Migration order

1. direct video call;
2. shared screen-share coordinator;
3. audio rooms;
4. video rooms/live streams;
5. classrooms;
6. captions/recording/replay integrations.

## Workstream E: doodles and whiteboards

**Issue:** #7465

### Message doodle reference

- Pointer Events and coalesced samples;
- normalized points with pressure/time;
- `perfect-freehand` outline;
- bounded immutable history;
- device-pixel-ratio renderer;
- JSON source plus raster/SVG derivative;
- Blob/File upload through asset platform;
- alt/description and semantic toolbar.

### Whiteboard gate

Do not install tldraw, Excalidraw and Yjs into production together.

Run the same scenario:

```text
8 users
teacher and read-only roles
2 pages
pen/text/shape/image
reconnect
30-minute session
persistence/export
mobile/high zoom
moderated assets
```

Compare:

- Angular integration;
- self-hosted sync and persistence;
- data/asset security;
- bundle/memory/network;
- accessibility and non-canvas alternatives;
- licence and upgrade ownership;
- tests and operational recovery.

Result: adopt one, or reject all and keep lightweight doodles.

## Workstream F: motion and hero transitions

**Issues:** #7457, #7469

### Motion hierarchy

```text
CSS transition/keyframes
  -> ordinary state change

animate.enter / animate.leave
  -> DOM lifecycle

View Transition API
  -> progressive route/shared-element continuity

Lottie
  -> authored non-interactive illustration

Rive trial
  -> interactive state machine only
```

### Hero reference flows

- discovery card avatar to profile header;
- moment thumbnail to media/detail;
- lesson/card to learning detail;
- chat attachment to viewer.

### View Transition requirements

- support detection and immediate fallback;
- unique stable transition names;
- rapid-navigation cancellation;
- no sensitive snapshot risk without review;
- focus and scroll/history correctness;
- reduced-motion immediate path;
- no business-state dependency on animation completion.

### Lottie cleanup

- one adapter and allowlisted asset catalogue;
- remove `ngx-lottie` if unused;
- lazy load player/assets;
- pause/destroy offscreen/teardown;
- static/reduced-motion fallback;
- source/licence/size/loop metadata;
- deterministic Storybook/visual snapshots.

### Rive trial

Only interactive listening/thinking/speaking, pronunciation or similarly state-driven cases qualify. Decorative loops remain CSS/Lottie/static.

## Workstream G: shared product primitives

### Tours

**Issue:** #7470

- one versioned tour schema;
- stable `data-tour-id` targets;
- bounded target readiness, no arbitrary sleeps;
- server/local completion policy;
- Driver.js renderer trial;
- keyboard, focus, screen-reader, mobile, RTL and 400% zoom;
- remove Joyride and duplicate engines after migration.

### Emoji

**Issue:** #7471

- lazy Angular adapter around maintained Unicode data;
- standard Unicode string payload;
- locale/search/skin-tone/recents policy;
- IME/grapheme-safe insertion;
- semantic popover/sheet shell;
- remove embedded catalogue.

### Loading/status

**Issue:** #7479

- shared semantic initial/refresh/stale/empty/processing/unavailable/error patterns;
- truthful progress only;
- static reduced-motion skeleton;
- durable job status, retry and cancellation;
- remove `ngx-skeleton-loader` and duplicate spinners.

## Workstream H: notification and deep-link interaction

**Issues:** #7475, #7477, #7476

- Angular `SwPush` PWA subscription and click handling;
- VAPID Web Push provider;
- FCM provider for native/platform endpoints;
- endpoint rotation/invalidation;
- BullMQ delivery and dead letter;
- typed allowlisted deep links;
- server reauthorization after open;
- DND through explicit local time and IANA zone;
- private preview policy;
- no fictional notification/count fallback.

## Workstream I: privacy and content safety

Every media/interaction feature must define:

- who can create, view, reference, download and delete;
- direct object versus asset-record authorization;
- public/private/signed delivery;
- RLS and backend policy;
- retention and account-deletion handling;
- moderation/reporting evidence;
- local draft and cache lifetime;
- provider and telemetry exposure;
- user-visible failure/recovery.

### High-risk formats

- SVG: do not inline arbitrary uploaded SVG.
- HTML: no uploaded HTML execution.
- documents/archives: separate scanner/parser policy and limits.
- video/audio: byte probe, stream count, duration and resource limits.
- animation JSON: allowlisted product assets only unless a separate user-content threat model exists.
- whiteboard documents: schema/size/object/point/asset bounds.

## Workstream J: accessibility equivalence

A visual/media package does not satisfy accessibility by itself.

| Visual feature | Required semantic/equivalent path |
|---|---|
| Doodle canvas | toolbar state, description/alt, open/download, truthful keyboard limits |
| Waveform | play/pause/seek/time/speed/transcript controls |
| Video/call | labelled controls, participant/connection announcements, captions policy |
| Screen share | presenter/source state, stop control, unsupported-audio status |
| Hero transition | ordinary navigation/focus/scroll path |
| Lottie/Rive | text/static equivalent and reduced-motion state |
| Product tour | semantic panel controls and skip/replay |
| Emoji grid | searchable named keyboard grid and text input remains available |
| Skeleton/progress | status/progress semantics and no decorative announcement spam |
| Map | full semantic result list and filters |

## Reference PR strategy

### PR group 1: contracts and failure semantics

- asset/draft/session/doodle states;
- truthful API error/result types;
- no fake URL/success;
- generated API/database contracts.

### PR group 2: avatar/cover upload reference

- intent, direct transfer, finalisation, Sharp worker, delivery and UI.

### PR group 3: voice-note reference

- capture, draft, upload, transcode, peaks, playback and send.

### PR group 4: direct video-call reference

- shared media session, devices, screen share, attachments and teardown.

### PR group 5: doodle reference

- vector engine, history, export, asset upload and chat rendering.

### PR group 6: UI primitives

- loading/status, animation adapter/hero transition, tours and emoji.

Each group should be independently reviewable. Do not combine upload, LiveKit, doodle, animation and tour migrations into one PR.

## Collision map

| Shared area | Issues | Coordination rule |
|---|---|---|
| Frontend package manifest | #7450, #7453, #7454, #7456, #7465-#7471, #7477-#7479 | #7452/workspace owner coordinates dependency additions/removals |
| Angular app bootstrap | #7445, #7454, #7457, #7469, #7475, #7477 | small provider/service-worker/polyfill changes; security first |
| Media components/services | #7465-#7468 | asset contract lands before feature adapters |
| Backend media/storage | #7448, #7449, #7467, #7468 | schema/queue ownership first, processor PRs separated |
| Chat composer/message | #7450, #7465, #7467, #7471, #7473 | stable draft/send/asset contracts; one feature migration at a time |
| Call/room components | #7466, #7469, #7479 | media state first, layout motion/loading second |
| Offline database | #7450, #7465, #7467, #7468 | one Dexie schema/migration owner |
| UI library/catalogue | #7453, #7454, #7469, #7470, #7471, #7479 | public primitives/stories before broad consumers |
| Notifications/deep links | #7445, #7475, #7476, #7477 | auth/content/time policies remain server authoritative |
| CI/dependencies | #7452, #5365, #7478 | Knip/provenance baseline after entries/workspaces are correct |

## Rollout flags

Suggested independent flags:

```text
media_asset_intents
media_direct_upload
media_multipart_upload
audio_capture_v2
audio_waveform_v2
livekit_media_session_v2
doodle_vector_v2
view_transitions
lottie_catalogue_v2
rive_interaction_trial
product_tour_v2
emoji_picker_v2
web_push_v2
temporal_time_domain_v2
```

Flags protect exposure and cohort rollout. They do not permit unsafe legacy behaviour such as fake URLs, fictional data or weak authorization.

## Operations and metrics

### Asset/upload

- intent count/outcome;
- bytes and transfer duration buckets;
- abandoned multipart count;
- verify/process queue wait/runtime/failure;
- derivative/orphan/storage volume;
- asset state age and stuck-state alerts.

### Audio

- permission/capture failure class;
- actual browser MIME family;
- draft size/duration buckets;
- probe/transcode failure;
- playback/autoplay failure;
- no filename/content/user ID labels.

### LiveKit

- token/join latency;
- reconnect count/duration;
- permission/device/publish/share failures;
- connection quality aggregates;
- attachment/listener leak assertions in tests;
- no tokens, SDP, room/user content or device labels.

### Doodle/animation/UI

- bounded engine/version/outcome/performance;
- no raw strokes, animation URLs, tour DOM text or emoji search terms;
- Core Web Vitals/input readiness and low-end samples;
- renderer failure and fallback use.

## Required test layers

### Unit

- state machines and reducers;
- MIME negotiation;
- asset policy and idempotency;
- pointer/stroke/history;
- time/permission/error mapping;
- package adapters with fakes.

### Integration

- R2-compatible signed upload/finalisation;
- Sharp and FFmpeg fixtures;
- BullMQ retry/idempotency;
- Supabase RLS and asset ownership;
- LiveKit token grants/role policy with fakes or isolated test service;
- Web Push/FCM provider fixtures.

### Browser

- permission denied/unavailable;
- capture, cancel, route teardown and retry;
- upload interruption/resume;
- call reconnect/share stop/device removal;
- doodle pointer/high-DPI/undo;
- focus, keyboard, screen reader semantics;
- RTL, high contrast, reduced motion and 400% zoom;
- unsupported API fallback;
- no fake completion/data.

### Performance/fault

- low-end/mobile CPU, memory and battery samples;
- large/corrupt/mislabelled media;
- R2/Redis/provider/worker outage;
- restart during upload/process;
- duplicate finalise/job delivery;
- repeated route/session open/close leak test;
- excessive pointer/document/animation input bounds.

## Completion criteria

The media and interaction roadmap is complete when:

1. all user-generated media uses one asset state and upload/finalisation platform;
2. recorded audio uses one capture/draft/transcode/playback platform;
3. LiveKit consumers use one media-session/device/track lifecycle;
4. message doodles use a versioned vector document;
5. full whiteboard adoption has an explicit product decision and one engine at most;
6. route/hero, Lottie and interactive vector motion follow the native-first hierarchy;
7. tours, emoji and loading states use shared governed primitives;
8. no failure fabricates a URL, record, notification, participant or completion;
9. byte validation, RLS/backend authorization, retention and moderation are enforced;
10. accessibility equivalents and low-end performance are tested;
11. duplicate feature implementations and obsolete dependencies are removed;
12. docs, dashboards, runbooks and generated contracts match the implementation on `main`.
