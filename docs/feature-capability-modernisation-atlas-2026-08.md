# Feature capability modernisation atlas

**Repository:** `elgansayer/elgl`  
**Audit date:** 2026-08-19  
**Programme tracker:** #7463  
**Platform programme:** #7458  

## Purpose

This document extends the repository-wide technology audit into a capability-by-capability assessment.

The first audit established that the main foundations already fit the product:

- Angular 22 for the user web application and separate admin portal;
- NestJS 11 for the modular backend;
- Supabase for authentication, PostgreSQL, PostGIS, storage metadata and row-level security;
- Centrifugo for realtime messaging and presence;
- LiveKit for audio/video media rooms;
- Cloudflare R2 through the S3-compatible AWS SDK;
- Relay semantic tokens and repository-owned Spartan Helm components;
- the provider-neutral OpenHands Factory for autonomous engineering orchestration.

The next question is more detailed:

> For every user-facing capability, are we using a maintained package or platform for the hard infrastructure, or are we rebuilding it inside feature components and services?

This atlas answers that question and assigns one of five dispositions:

| Disposition | Meaning |
|---|---|
| **Keep** | Existing package/platform is appropriate and should remain authoritative. |
| **Consolidate** | Existing package fits, but repository wrappers and feature implementations must converge. |
| **Replace** | Bespoke, misleading or weak implementation should be superseded. |
| **Trial** | Candidate package requires a bounded proof of concept and explicit go/no-go result. |
| **Remove** | Dependency or feature path is unused, duplicated, stubbed or retired by another migration. |

Installing a package is not proof that a feature works. A feature is considered implemented only when its runtime path, authoritative backend behaviour, failure states, tests, operations and accessibility are present.

## Executive findings

### Critical correctness findings

1. Runtime feature failures can return fictional success data. Notifications can return hard-coded records and counts, discovery/user services contain mock fallbacks, and failed recording upload can emit a synthetic URL. Track this under #7464.
2. Recorded audio is duplicated across several components. Browser-produced WebM can be labelled as OGG/M4A without byte-level verification. Track the shared capture/transcode platform under #7467.
3. NLP provider failure can return source text as a successful translation/transliteration and can claim zero grammar errors without a completed grammar evaluation. Track this under #7474.
4. Browser Firebase messaging is installed but the frontend integration is a stub. Track real Angular Web Push and channel-neutral endpoints under #7475.
5. A global backend pipe recursively mutates nearly every request string through HTML sanitisation without knowing the eventual sink. Track typed content policies under #7476.
6. Daily/calendar behaviour frequently relies on `Date`, ISO slicing and implicit UTC/local assumptions. Track explicit Temporal semantics under #7477.

### Highest-leverage product migrations

1. Replace the fixed bitmap doodle pad with a vector stroke document and `perfect-freehand`, while keeping full whiteboards behind a product gate: #7465.
2. Keep LiveKit and consolidate every room, device, track, screen-share and attachment path behind one Angular media-session platform: #7466.
3. Add a single MediaRecorder, draft, waveform, playback and FFmpeg processing path: #7467.
4. Keep R2/Sharp and add direct resumable upload intents plus durable derivatives: #7468.
5. Define a native-first motion hierarchy, progressive View Transitions for hero/shared elements, one Lottie adapter and a bounded Rive trial: #7469.
6. Replace contradictory Joyride/custom tour engines with one typed tour model and renderer decision: #7470.
7. Replace the embedded Unicode emoji catalogue with a maintained lazy-loaded adapter: #7471.
8. Add MapLibre only after an explicit privacy and safety decision; keep PostGIS authoritative: #7472.
9. Replace bespoke correction diffing with a versioned multilingual jsdiff adapter: #7473.
10. Add every-package ownership and automated Knip/provenance governance: #7478.
11. Remove one-off skeleton/spinner dependencies in favour of shared semantic loading states: #7479.

## Capability matrix

| Capability | Current evidence | Disposition | Target | Issue |
|---|---|---|---|---|
| User authentication | Supabase session plus runtime mock fallback | Replace unsafe fallback | Supabase-only fail-closed auth; MSW fixtures | #7445 |
| MFA/passkeys | Application TOTP secrets and client-only WebAuthn ceremony | Replace | Supabase MFA/AAL and server-verified passkeys | #7446 |
| API clients | Hand-written Angular HTTP services/DTOs | Replace transport duplication | Generated Angular SDK from Nest OpenAPI | #7447 |
| Durable background work | Cron, EventEmitter and polling workers | Replace durable paths | BullMQ with idempotency/outbox | #7448 |
| Database authority | Supabase and TypeORM migration histories | Consolidate | Supabase CLI migrations and generated types | #7449 |
| Browser offline data | Many raw IndexedDB databases and queues | Consolidate | Dexie and one durable outbox | #7450 |
| SRS scheduling | Bespoke mutable SM-2 | Replace by measured rollout | `ts-fsrs`, immutable review log | #7451 |
| Repository orchestration | Manual multi-root npm scripts | Consolidate | npm workspaces and incremental Nx | #7452 |
| UI primitives | Partial Spartan plus separate admin SCSS | Consolidate | Shared Relay/Spartan library | #7453 |
| Component catalogue | Bespoke pages/scripts/specs | Trial and consolidate | Storybook Angular Vite, browser tests, axe | #7454 |
| Telemetry | Pino, Prometheus, StatsD and custom fields | Consolidate | OpenTelemetry/OTLP with Pino correlation | #7455 |
| Frontend state | Signals with mixed transport/offline/UI concerns | Consolidate | Generated clients, resources, SignalStore, Dexie | #7456 |
| Angular motion runtime | Deprecated animation provider/package | Replace | Native CSS and `animate.enter`/`animate.leave` | #7457 |
| Backend resilience | Duplicate retry and breaker implementations | Consolidate | Cockatiel policy registry | #7461 |
| Runtime placeholder data | Fictional notifications/users/counts/URLs | Remove | Truthful empty, stale, unavailable and failed states | #7464 |
| Doodles | Fixed bitmap canvas with mouse/touch branches | Replace | Vector stroke document and `perfect-freehand` | #7465 |
| Collaborative whiteboard | No coherent platform | Trial only after product need | tldraw, Excalidraw or narrow Yjs comparison | #7465 |
| Calls/rooms/screen share | LiveKit plus duplicated feature lifecycle | Keep LiveKit; consolidate wrappers | One Angular media-session platform | #7466 |
| Voice notes/audio intros | Several MediaRecorder implementations | Consolidate and correct | Shared capture state, WaveSurfer trial, FFmpeg worker | #7467 |
| Media upload | API-buffered FormData and feature-specific processing | Replace transfer/finalisation | Direct R2 intents, Uppy trial, BullMQ derivatives | #7468 |
| Image crop | `ngx-image-cropper` is already used | Keep | Shared upload and accessible dialog shell | #7468 |
| Image derivatives | Sharp backend service | Keep and move durable work | Canonical worker variants and metadata | #7468 |
| Hero/shared-element motion | No canonical route transition contract | Adopt native progressively | View Transition API adapter | #7469 |
| Authored animations | Direct `lottie-web` wrapper plus installed `ngx-lottie` | Consolidate/remove duplicate | One lazy governed Lottie adapter | #7469 |
| Interactive vector animation | Not established | Trial | Rive only for state-machine interactions | #7469 |
| Product tours | Joyride and custom engines contradict | Consolidate/replace | Typed tour schema; Driver.js renderer pilot | #7470 |
| Emoji picker | Large hard-coded catalogue | Replace | `emoji-picker-element` adapter and Unicode data | #7471 |
| Discovery map | List UI, PostGIS backend, no map SDK | Product gate then trial | Privacy aggregation plus lazy MapLibre | #7472 |
| Corrections diff | Bespoke `Intl.Segmenter` diff | Replace algorithm | jsdiff adapter with multilingual token policy | #7473 |
| Language detection | `node-nlp` alpha for narrow detection | Benchmark | explicit metadata, provider detection, tinyld/franc trial | #7474 |
| Translation | Provider call with misleading source-text fallback | Replace result semantics | typed providers and truthful unavailable state | #7474 |
| Transliteration | Reverse translation/source fallback | Replace | language/script-specific versioned adapters | #7474 |
| Grammar checking | Translation/dictionary proxy and zero-error fallback | Replace | actual grammar provider or validated LLM adapter | #7474 |
| TTS/pronunciation URL | Constructed unsupported external URL | Replace | approved provider or device-local labelled speech | #7474 |
| Browser push | Firebase browser package plus stubs | Replace | Angular `SwPush` and VAPID Web Push | #7475 |
| Native/platform push | Firebase Admin backend sender | Keep and isolate | `FcmProvider` with current identifier/API policy | #7475 |
| In-app notifications | Database records plus fictional fallback | Keep records; remove fallback | durable event plus channel delivery pipeline | #7464, #7475 |
| Plain text handling | Global recursive HTML sanitisation | Replace architecture | preserve plain text, safe sinks and typed validation | #7476 |
| Rich HTML | DOMPurify/jsdom without one content policy | Consolidate | one versioned allowlist and controlled sink | #7476 |
| URL/deep-link handling | Mixed generic sanitisation and feature logic | Consolidate | purpose-specific parsers/allowlists | #7476 |
| Date/time semantics | Ad-hoc `Date`, ISO slicing and zone assumptions | Replace calendar layer | Temporal adapter and explicit time-domain types | #7477 |
| Loading states | package skeleton plus custom spinners/booleans | Consolidate/remove dependency | shared semantic loading/progress states | #7479 |
| Charts | Chart.js and ng2-charts | Keep | shared chart/accessibility wrapper as needed | existing analytics work |
| Realtime messaging | Centrifugo client/server boundary | Keep | typed event contracts and durable persistence | existing chat/realtime work |
| Media realtime | LiveKit | Keep | consolidate application lifecycle | #7466 |
| Object storage | R2 through AWS SDK | Keep | direct intents and canonical asset state | #7468 |
| Payments | Stripe SDK | Keep | idempotent webhooks, durable jobs and audit | existing payment/security work |
| OpenHands Factory | provider-neutral Claude/Codex/Google/OpenCode/OpenHands routing | Keep and harden | current Factory remains orchestration authority | Factory docs/tests |

## 1. Messaging and realtime

### Keep Centrifugo

Centrifugo already owns fan-out, subscription transport, presence and reconnect concerns. Replacing it with custom WebSockets or Socket.IO would rebuild infrastructure without solving the observed product problems.

Application work should focus on:

- versioned event payloads;
- server-authoritative membership and visibility;
- persistence/outbox ordering;
- idempotent message sends and offline replay;
- generated transport contracts where HTTP and realtime payloads overlap;
- bounded presence/typing/read-receipt semantics;
- observability without logging private message content.

### Replace fictional fallback content

A messaging or notification surface must distinguish:

```text
empty successful result
cached/stale real result
offline local draft
provider or database unavailable
permission denied
failed operation
```

It must never fill a screen with fictional users, messages, notification counts or media URLs because a dependency failed.

### Emoji

The product should store standard Unicode sequences, not package-specific IDs. `emoji-picker-element` is a trial implementation behind an Angular facade. Custom gifts/stickers remain asset records under the media platform and do not share Unicode catalogue semantics.

### Corrections

Store immutable original/corrected plain text and derive normalized spans through a versioned diff engine. Do not persist rendered HTML. The correction UI must provide non-colour semantics and structured SRS actions.

## 2. Drawing, annotation and whiteboards

### Message doodles

The current fixed bitmap canvas is too low-level for continued extension. The target uses:

- Pointer Events and pointer capture;
- normalized vector stroke data;
- pressure-aware `perfect-freehand` outlines;
- bounded undo/redo;
- high-DPI responsive rendering;
- Blob/File export through the media platform;
- optional author description for accessibility;
- local unsent draft persistence and idempotent upload.

### Full collaborative whiteboard

A full whiteboard is not automatically approved. It becomes appropriate only when the product requires several of:

- multiple simultaneous editors;
- shapes, text, images and selections;
- pages and viewport presence;
- teacher/read-only roles;
- durable collaborative documents;
- reconnect/offline collaboration;
- moderation and asset permissions.

The comparison must include Angular integration cost because leading candidates are React-centric. Only one production engine may survive the trial.

## 3. Audio capture and playback

### Separate room audio from recorded files

LiveKit owns realtime room tracks. MediaRecorder owns local recorded-file capture. They must not be substituted for each other.

The shared recorded-audio platform must provide:

- browser capability and MIME negotiation;
- one capture state machine;
- deterministic stream/object URL cleanup;
- bounded user-partitioned local drafts;
- direct/resumable upload;
- server-side ffprobe verification;
- canonical FFmpeg transcode in a durable worker;
- duration, codec/container and waveform-peak metadata;
- semantic playback controls and optional WaveSurfer enhancement;
- truthful processing/failure state.

The browser-selected filename or MIME is never authoritative.

## 4. Calls, rooms and screen sharing

### Keep LiveKit

Screen sharing is already a native LiveKit source/publication. The application should not add another screen-capture or WebRTC SDK.

Consolidation is required above LiveKit:

```text
MediaSession
  room connection
  participant/publication state
  device and permission state
  local microphone/camera/share commands
  track attachment registry
  audio playback/autoplay coordination
  reconnect and teardown
  safe diagnostics
```

Backend token issuance remains authoritative for room membership, speaker/host grants, recording and moderation.

## 5. Uploads, images, audio and video assets

### Keep R2 and AWS SDK

R2 remains the storage platform. The backend should issue narrowly scoped upload intents instead of buffering large media in API processes.

### Trial Uppy Core plus AWS S3 plugin

Uppy is useful for queue/progress/pause/resume/multipart mechanics, but product UI remains Relay/Spartan. Retain Uppy only when:

- Angular/SSR integration is stable;
- multipart resume works against R2;
- accessibility and mobile behaviour pass;
- bundle/runtime cost is justified;
- feature code remains behind one adapter.

### Keep `ngx-image-cropper`

Interactive crop is already delegated to a maintained component. It remains a local preview/editor. Server-side Sharp still validates and creates canonical variants.

### Durable asset lifecycle

A storage object is not a ready asset. Use explicit states:

```text
DRAFT
UPLOADING
UPLOADED_UNVERIFIED
VERIFYING
PROCESSING
READY
FAILED
QUARANTINED
EXPIRED
DELETED
```

Messages/posts/profiles reference asset IDs and readiness policy, not arbitrary browser-provided URLs.

## 6. Motion, hero transitions and authored animation

### Native-first hierarchy

1. CSS transition/keyframes for simple state.
2. Angular `animate.enter` and `animate.leave` for DOM lifecycle.
3. View Transition API for progressive route/shared-element transitions.
4. One Lottie adapter for authored non-interactive animation.
5. Rive only after a state-machine interaction trial.

### Hero/shared-element examples

Approved reference candidates:

- discovery card avatar to profile header;
- moment thumbnail to detail/media viewer;
- lesson/card to focused learning detail;
- chat attachment thumbnail to full-screen viewer.

Every transition must have an immediate fallback with identical focus, navigation and state correctness.

### Lottie consolidation

The repository directly wraps `lottie-web`; `ngx-lottie` appears unused. Verify production/build entry points, then remove the duplicate package. Assets need allowlisting, provenance, size/loop budgets, lazy loading, teardown and reduced-motion/static fallback.

### Rive trial

Trial only interactive state-machine cases such as listening/thinking/speaking avatar states or pronunciation feedback. A decorative loop does not justify a second vector runtime.

## 7. Product tours and coachmarks

The current Joyride/custom split must converge on one versioned product-tour definition model. A renderer package is replaceable; product definitions and completion state are not.

Driver.js is a bounded renderer pilot. It must prove:

- Angular lifecycle and lazy-route behaviour;
- stable target resolution without arbitrary sleeps;
- CSP and overlay compatibility;
- keyboard, focus and screen-reader behaviour;
- RTL, translations, mobile and 400% zoom;
- graceful missing-target fallback;
- teardown on route/error.

If it fails, the same model can use a Spartan popover/dialog renderer. Do not retain two engines.

## 8. Loading, progress, stale and failure states

A skeleton is not a general loading architecture. The application needs distinct states:

```text
loading initial content
refreshing existing content
stale cached data
empty successful result
mutation in progress
durable server processing
unavailable dependency
failed operation
```

Remove `ngx-skeleton-loader` after migrating its consumer. Shared primitives use native CSS, Relay tokens and semantic progress/status behaviour. Lottie/Rive do not become ordinary spinners.

## 9. Language services

### Split capabilities

Translation, transliteration, grammar, detection, TTS, STT and pronunciation scoring are different contracts. Provider failure cannot return a semantically different success.

### Language detection

Order of preference:

1. explicit source/content language;
2. trusted context such as lesson/profile language;
3. provider-returned detection already produced during the requested operation;
4. a benchmarked local detector;
5. unknown/low confidence.

Benchmark current `node-nlp` against `tinyld` and `franc-min`. Remove `node-nlp` and the SheetJS tarball if its narrow detection performance does not justify the alpha dependency tree.

### Transliteration

Use language/script-specific versioned adapters. Translation to English is not transliteration. The first corpus should cover Japanese, Mandarin and another priority script.

### Grammar

Use a provider explicitly capable of correction or a validated structured LLM adapter. Dictionary lookup is not grammatical evaluation. Unavailable is not “zero errors”.

## 10. Learning and SRS

Keep the product domain while replacing infrastructure:

- `ts-fsrs` behind a versioned application scheduler;
- immutable review events;
- original offline occurrence time plus server receive time;
- idempotency and deterministic replay;
- explicit rating mapping and cohort rollout;
- Temporal-based due/study-day semantics;
- Dexie outbox for offline review submission;
- structured corrections feeding sentence/example cards.

Do not replace the entire learning product with a generic flashcard SaaS package.

## 11. Discovery, location and maps

PostGIS remains authoritative. A map is optional presentation, not a location database.

Before adopting MapLibre, approve:

- the user goal;
- coarse/aggregate display policy;
- sparse-area suppression;
- block/incognito/minor handling;
- tile/style provider;
- retention and permission policy;
- a full semantic list equivalent.

Exact private coordinates must never be sent to another user's browser merely to jitter them client-side.

## 12. Notifications and push

### In-app record

The database notification is authoritative. External delivery is a side effect with per-endpoint attempts.

### Browser PWA

Use Angular `SwPush` and VAPID Web Push. Remove the browser Firebase SDK when no other implemented browser capability needs it.

### Native/platform delivery

Keep `firebase-admin` behind a provider adapter. Centralize initialization, current identifier/API semantics and partial-failure cleanup.

### Durable delivery

Persist event/outbox, enqueue BullMQ delivery, enforce preference/DND/privacy at send time, and retain dead-letter visibility. Push-service acceptance does not mean human read.

## 13. Time zones and calendars

Every field must be one of:

- instant;
- zoned date-time;
- plain date;
- plain local time;
- duration;
- explicit recurrence.

Adopt a Temporal compatibility layer, use native support where available and one selected polyfill where needed. Do not store numeric offsets as time zones.

Critical migration domains:

- SRS/review occurrence;
- streak/study-day cutoff;
- daily quotas and rewards;
- DND;
- events/lessons/rooms;
- payment/escrow deadlines;
- retention/account deletion;
- recurring/durable jobs.

## 14. Content and sanitisation

### Plain text

Preserve plain text and render through Angular interpolation/text sinks. Validate length, Unicode/control characters and domain rules. Do not HTML-sanitize every input string merely because it may eventually be displayed.

### Rich text

Allow only for explicit features. Use one versioned DOMPurify allowlist and one controlled trusted-HTML sink. Keep jsdom current when server-side sanitisation is retained.

### URLs

Parse and allowlist by purpose. HTML sanitisation is not URL validation. Link preview must also defend against SSRF and redirects/private networks.

### Package cleanup

Remove `xss` if usage inventory proves it is redundant. Remove duplicate frontend/server wrappers only when the approved rich-content sinks remain protected.

## 15. Economy, subscriptions and payments

Keep Stripe and the repository's product model. Improve infrastructure through:

- verified raw-body webhook handling;
- idempotency and durable side effects;
- authoritative Supabase transactions/RPCs;
- BullMQ jobs and dead-letter operations;
- Cockatiel provider-call policies with mutation safety;
- Temporal deadline semantics;
- generated API clients;
- explicit degraded state that never fabricates balances/payment success;
- audited admin operations.

Do not add another commerce framework over Stripe without a concrete marketplace/tax/catalogue requirement.

## 16. Admin and moderation

Keep the admin portal separately deployable and capability-gated. Share:

- generated API client;
- database contracts where safe;
- Relay tokens and Spartan primitives;
- loading/error patterns;
- time and content policies;
- Storybook/browser accessibility fixtures.

Do not persist sensitive admin/moderation data offline by default. Every privileged read/mutation needs least privilege, reason, audit, redaction and stronger assurance where policy requires it.

## 17. Charts and analytics

Keep Chart.js/ng2-charts. The current problem is not absence of a chart package.

Create a shared chart wrapper only where repeated needs justify it:

- semantic title/description;
- equivalent table/summary;
- high contrast and non-colour series distinction;
- RTL/localised axes and numbers;
- bounded points/downsampling;
- responsive/high-zoom fallback;
- no sensitive raw data in client analytics.

OpenTelemetry owns technical instrumentation. Product analytics remains a separate consent/privacy-governed capability.

## 18. OpenHands Factory

The Factory already has provider-neutral Claude, Codex, Google, OpenCode and OpenHands adapters, plus policy, router, health and hardened process modules.

Keep the Factory as the authority for:

- issue discovery and scheduling;
- worktrees and branch safety;
- task state and retries;
- provider health/fallback;
- planning, implementation, independent review and repair;
- verification, CI repair, PR creation and merge safety.

Do not revive the old swarm or let an individual provider bypass reviewed-SHA, verification or merge policy. Package governance must not copy subscription credentials into builds, worktrees or logs.

## Candidate package decision table

| Candidate | Status | Intended boundary | Decision gate |
|---|---|---|---|
| `perfect-freehand` | Adopt candidate | Doodle stroke geometry | vector fidelity, pressure, performance and tests |
| tldraw | Trial only | Full collaborative whiteboard | product need, Angular integration, self-hosted sync, accessibility |
| Excalidraw | Trial only | Full collaborative whiteboard | same scenario comparison; one winner only |
| Yjs | Conditional | Narrow collaboration data model | only when CRDT need remains after whiteboard decision |
| WaveSurfer.js | Trial | Waveform/seek/regions | bundle, memory, low-end performance and accessible equivalent |
| Uppy Core + AWS S3 | Trial | Resumable/direct R2 transfer | R2 multipart, Angular adapter, accessibility and bundle |
| View Transition API | Progressive adopt | Hero/shared-element routes | fallback, focus, privacy and browser tests |
| `lottie-web` | Keep/consolidate | Authored non-interactive animation | one adapter, asset governance and lazy load |
| `ngx-lottie` | Remove candidate | Duplicate Lottie wrapper | remove when source/build proof confirms unused |
| dotLottie player | Trial only | Compressed Lottie packaging | measured asset/runtime improvement |
| Rive | Trial only | Interactive state machines | state-driven value, performance, accessibility and fallback |
| Driver.js | Trial | Product-tour renderer | Angular lifecycle, accessibility, CSP and missing targets |
| `emoji-picker-element` | Trial | Unicode picker/data | accessibility, locale, lazy bundle and low-end performance |
| MapLibre GL JS | Product-gated trial | Discovery map | privacy/safety approval and semantic list parity |
| `diff`/jsdiff | Adopt candidate | Correction diff engine | multilingual golden corpus and reconstruction invariants |
| `tinyld` | Benchmark | Language detection | corpus accuracy/calibration/dependency cost |
| `franc-min` | Benchmark | Language detection | same benchmark; support/size trade-off |
| Angular `SwPush` | Adopt | PWA subscription/click handling | service-worker integration and browser tests |
| `web-push` | Adopt candidate | Server Web Push protocol | current maintenance/security and delivery fault tests |
| Temporal native/polyfill | Adopt | Time-domain layer | support matrix, parity and bundle/runtime cost |
| Knip | Adopt after workspaces | Unused dependencies/files/exports | correct entry configuration and classified baseline |
| Cockatiel | Adopt candidate | Backend provider resilience | typed error predicates and idempotent mutation rules |
| Storybook Angular Vite | Preview trial | Executable component catalogue | stable production/CI build and provider integration |

## Technologies explicitly not approved

| Proposal | Decision | Reason |
|---|---|---|
| Angular to React/Vue/Svelte rewrite | Reject | Existing Angular architecture is not the capability bottleneck |
| NestJS replacement | Reject | Durable jobs, contracts, data and provider adapters are the problems |
| Socket.IO/custom WebRTC replacing LiveKit | Reject | Rebuilds media infrastructure already delegated correctly |
| Custom WebSockets replacing Centrifugo | Reject | Rebuilds fan-out/presence/reconnect infrastructure |
| Google Maps/Mapbox by default | Reject | No product/safety decision; MapLibre is sufficient if approved |
| Full whiteboard for chat doodle only | Reject | Excessive runtime/integration/operational cost |
| GSAP/general animation runtime by default | Reject | Native CSS/View Transitions cover standard motion |
| Rive for decorative loops | Reject | Duplicates Lottie/static asset role |
| One global NgRx store | Reject | Local, resource, realtime and offline state need different owners |
| Firebase browser SDK only for PWA push | Reject | Angular SwPush and standard Web Push are sufficient |
| Universal Prisma/Drizzle migration | Reject | Supabase/RLS authority must be consolidated, not hidden by another ORM |
| Exact user pins on a discovery map | Reject | Privacy and abuse risk |
| Global request-input HTML mutation | Reject | Lacks typed field and output-sink context |
| Source text as translation fallback | Reject | Misrepresents provider failure as success |

## Cross-feature dependency graph

```text
#7452 npm workspaces/Nx
  +--> shared UI, API, DB, time and media libraries
  +--> #7478 Knip/dependency governance

#7449 Supabase schema/types
  +--> #7447 generated API
  +--> asset, endpoint, correction, review and time contracts

#7448 BullMQ
  +--> media derivatives (#7468)
  +--> audio transcode (#7467)
  +--> push delivery (#7475)
  +--> retention/scheduling (#7477)
  +--> dead-letter operations (#3503)

#7450 Dexie
  +--> unsent audio/doodle/media drafts
  +--> SRS review outbox
  +--> deliberate offline state only

#7453 shared Relay/Spartan
  +--> tour, emoji, loading, media and correction UI
  +--> #7454 executable component tests

#7455 OpenTelemetry
  +--> jobs, providers, media, calls, notifications and migrations

#7464 truthful failure states
  +--> auth, notifications, discovery, media and NLP

#7468 media assets
  +--> doodles (#7465)
  +--> recorded audio (#7467)
  +--> gifts/stickers and moments/classrooms

#7476 content policies
  +--> corrections, provider output, links, email and notifications

#7477 time platform
  +--> SRS, quotas, DND, events, retention, payments and jobs
```

## Execution waves

### Wave 0: stop false success and unsafe mutation

1. #7445 runtime mock auth.
2. #7464 runtime fictional feature fallbacks.
3. #7474 misleading NLP outcomes.
4. #7476 global sanitisation architecture.
5. Begin #7449 and #7447 contract/schema authority.

### Wave 1: durable shared infrastructure

1. #7452 workspaces/Nx.
2. #7448 BullMQ.
3. #7450 Dexie.
4. #7455 OpenTelemetry.
5. #7461 provider resilience.
6. #7477 Temporal compatibility layer.
7. #7478 dependency register and informational Knip baseline.

### Wave 2: media and interaction foundations

1. #7468 upload/asset state.
2. #7467 audio capture/transcode.
3. #7466 LiveKit consolidation.
4. #7465 vector doodle.
5. #7453 shared UI and #7454 catalogue.

### Wave 3: product primitives

1. #7469 motion/hero/Lottie/Rive decision.
2. #7470 tours.
3. #7471 emoji.
4. #7473 correction diff.
5. #7479 loading/status.
6. #7475 Web Push/notification delivery.
7. #7472 map decision/pilot if approved.

### Wave 4: remove replaced packages and paths

- delete fake data/success fallbacks;
- delete duplicate recorder/room/tour/loading implementations;
- remove `ngx-lottie`, browser `firebase`, `ngx-skeleton-loader`, `xss`, `node-nlp`, SheetJS, TypeORM, Speakeasy and other packages only when their owning issue reaches its removal gate;
- enforce new dependency/feature boundaries in CI;
- update architecture, operations and component documentation continuously.

## Required validation for feature/package adoption

Every package or platform trial must report:

### Product correctness

- exact capability it owns;
- behaviour with no data, invalid input, unsupported browser, dependency outage and partial failure;
- authoritative server/client boundary;
- migration and rollback.

### Security and privacy

- untrusted inputs and dangerous outputs;
- credentials, tokens, media, location and personal-data handling;
- dependency provenance/licence/advisories;
- abuse/rate-limit/authorization/RLS behaviour;
- logs/traces redaction.

### Accessibility and internationalisation

- keyboard and screen reader;
- visible focus and focus return;
- 200%/400% zoom/reflow;
- RTL and long translations;
- high contrast and non-colour semantics;
- reduced motion;
- mobile/touch and IME where relevant.

### Performance and operations

- initial/lazy bundle impact;
- CPU/memory/battery and low-end device behaviour;
- API/job/storage/network cost;
- graceful shutdown/reconnect/retry;
- metrics, dashboards and runbook;
- deterministic tests and no real paid credentials in ordinary CI.

### Exit rule

A trial ends in exactly one state:

```text
ADOPT and own through an adapter
REJECT and remove package/config/code
DEFER with no production dependency retained
```

## Definition of complete

The feature modernisation programme is complete when:

1. every user-facing capability has a documented platform/package/custom-code disposition;
2. every direct dependency has an owner and disposition in the dependency register;
3. critical fake-success and unsafe-content paths are removed;
4. media, offline, jobs, API, schema, UI, time and telemetry have one authoritative shared platform each;
5. retained custom code is product-domain logic rather than protocol/infrastructure reinvention;
6. all trials have explicit outcomes and no abandoned evaluation packages remain;
7. web and admin share the approved contracts/primitives while preserving separate security/deployment boundaries;
8. accessibility, internationalisation, privacy and low-end performance are executable tests rather than prose only;
9. OpenHands Factory safety, provider neutrality and reviewed-SHA/verification rules remain intact;
10. architecture, package and operations documentation match the code merged on `main`.
