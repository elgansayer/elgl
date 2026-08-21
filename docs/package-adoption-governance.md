# Package adoption and removal governance

**Applies to:** JavaScript, TypeScript, Python, native binaries, container tools, browser SDKs, hosted platform clients and coding-agent provider adapters  
**Dependency register:** [`dependency-disposition-register-2026-08.md`](./dependency-disposition-register-2026-08.md)  
**Programme:** #7463  
**Implementation:** #7478  

## Objective

Adopt maintained packages for hard, non-differentiating infrastructure while preventing dependency sprawl, duplicated frameworks, abandoned trials and unsafe supply-chain shortcuts.

The repository should generally:

```text
adopt protocol and platform machinery
wrap it behind typed application boundaries
own product policy and domain behaviour
measure the package in the real application
remove the package when the trial or capability ends
```

Package count is not the goal. The goal is less bespoke infrastructure with clearer ownership, safer upgrades and truthful product behaviour.

## Scope

This policy covers:

- npm runtime and development dependencies;
- Python project and development dependencies;
- packages loaded dynamically or through framework configuration;
- generated-code tools and CLIs;
- native runtime dependencies such as FFmpeg/libvips;
- container/runtime services such as Redis, Centrifugo and LiveKit;
- browser/service-worker SDKs;
- external provider adapters and protocol clients;
- coding-agent host CLIs used beneath the OpenHands Factory;
- GitHub Actions and remote install scripts where they become build dependencies.

It does not treat provider subscription credentials as dependencies. Credentials and authenticated CLI state remain deployment secrets outside repositories and build artifacts.

## Decision principles

### 1. Start from the capability

A package proposal begins with a problem and a capability boundary, not a package name.

Good:

> Message doodles need pressure-aware smooth vector strokes, responsive high-DPI rendering and undo/redo. Trial `perfect-freehand` as the stroke-geometry engine behind a versioned doodle document.

Bad:

> Add a canvas library because it looks useful.

### 2. Prefer one authority per concern

Examples:

| Concern | Authority |
|---|---|
| Authentication assurance | Supabase MFA/AAL |
| HTTP transport contracts | Nest OpenAPI and generated Angular client |
| Database schema history | Supabase CLI migrations |
| Durable jobs | BullMQ |
| Browser offline database | Dexie |
| Realtime fan-out/presence | Centrifugo |
| Calls/screen sharing | LiveKit |
| Object storage | R2 through S3 adapter |
| Image derivatives | Sharp in durable workers |
| Component behaviour | Spartan Brain |
| Product visual meaning | Relay tokens and owned Helm source |
| Server telemetry API/export | OpenTelemetry/OTLP |
| Factory orchestration | OpenHands Factory |

Do not add a second package that silently becomes another authority.

### 3. Prefer an adapter over package types in product code

Package-specific types and event models stay behind a repository-owned boundary.

```text
feature component
  -> application facade/interface
  -> package adapter
  -> maintained library/platform
```

This enables:

- controlled migration and rollback;
- package-specific failure mapping;
- test fakes without loading the real SDK;
- security/privacy policy at one boundary;
- replacement without rewriting every feature;
- stable generated/public contracts.

Direct package imports are acceptable inside the owning adapter/library and narrowly approved infrastructure modules. They are not the default for feature code.

### 4. Keep product policy in the repository

Packages may own:

- protocol implementation;
- parsing/encoding;
- queue leasing;
- media transport;
- stroke geometry;
- diff algorithm;
- IndexedDB transaction mechanics;
- component primitive interaction;
- OpenTelemetry context;
- standard date/time semantics.

The repository owns:

- who may use the feature;
- data visibility and RLS;
- user roles and moderation;
- quota, billing and retention;
- product state and copy;
- accessibility equivalence;
- offline conflict policy;
- migration/cohort policy;
- audit and abuse controls;
- what success and failure mean.

### 5. A fallback must preserve semantics

A dependency outage may produce:

- cached/stale real data;
- explicit unavailable state;
- retryable local draft;
- another provider with equivalent capability and contract.

It may not produce:

- fictional users/notifications/counts;
- source text labelled as translation;
- “zero grammar errors” without evaluation;
- a fake uploaded URL;
- successful payment/message/job state without authoritative completion.

### 6. Use native/framework capabilities before adding a broad runtime

Examples:

- CSS and Angular native enter/leave before a general animation runtime;
- View Transition API for progressive hero transitions;
- Angular `SwPush` for PWA Web Push;
- `Intl.Segmenter`, `DateTimeFormat` and `RelativeTimeFormat` for international primitives;
- Pointer Events and native MediaRecorder behind a small adapter;
- Web standard URL parser and safe Angular text bindings;
- Node `crypto.randomUUID` for simple UUID generation;
- built-in test runner for dependency-free agent skills.

Native use still needs a compatibility and accessibility plan.

## Proposal classes

### Adopt

Use when the package has clear ownership, mature compatibility and immediate required value.

Examples under evaluation:

- BullMQ for durable jobs;
- Dexie for the browser offline platform;
- jsdiff for correction spans;
- a selected Temporal polyfill behind the time adapter;
- `web-push` for server Web Push;
- `perfect-freehand` for doodle stroke geometry.

### Consolidate

Use when the package/platform is correct but repository use is fragmented.

Examples:

- LiveKit room/device/track/screen-share lifecycle;
- Lottie player and asset handling;
- DOMPurify rich-content policy;
- Pino/Prometheus/StatsD telemetry during OpenTelemetry migration;
- Angular/Spartan/Relay versions and shared library ownership.

### Trial

Use when integration, accessibility, cost or product fit is uncertain.

Examples:

- Uppy for resumable R2 transfer;
- WaveSurfer for waveform and regions;
- Driver.js for tour rendering;
- `emoji-picker-element` for the Unicode picker;
- MapLibre after privacy approval;
- Rive for interactive state-machine animation;
- tldraw or Excalidraw for a full collaborative whiteboard;
- Storybook Angular Vite while its integration is preview.

### Replace

Use when current behaviour is custom, misleading, insecure or structurally weak.

Examples:

- custom TOTP and client-only WebAuthn;
- manual HTTP clients where OpenAPI exists;
- polling workers for durable work;
- raw IndexedDB implementations;
- fixed bitmap doodle editor;
- duplicated MediaRecorder components;
- source-as-translation and zero-error grammar fallback;
- global request-string HTML mutation.

### Remove

Use when a dependency is unused, duplicated, misplaced or its capability has migrated.

Examples requiring final proof:

- `ngx-lottie` after one direct Lottie adapter;
- browser Firebase after Angular Web Push;
- `ngx-skeleton-loader` after shared loading primitives;
- `ngx-joyride` after the product-tour platform;
- `node-nlp` and SheetJS after detector benchmark;
- `xss` after content-policy convergence;
- TypeORM after Supabase schema authority;
- Speakeasy/QR packages after Supabase MFA;
- duplicate root translation/Artillery dependencies after workspaces.

## Required package decision record

Every new direct package or hosted SDK needs a decision record in its issue/PR. Use this structure.

### 1. Capability

```text
Capability:
Current implementation:
Observed defect or missing behaviour:
Why this is not product differentiation worth building:
Required user and operator outcomes:
```

### 2. Alternatives

Compare at least:

- existing repository/framework/native capability;
- maintain current custom implementation;
- proposed package;
- one credible alternative where available;
- defer/remove feature where the capability is optional.

Do not create a false comparison by naming obviously unsuitable alternatives.

### 3. Package health

Record:

```text
Package and exact proposed version
Publisher/maintainers
Primary repository and documentation
Release cadence and latest stable release date
Maintenance/security policy
Licence and attribution
Registry/source/provenance
Integrity/lockfile/SBOM behaviour
Native binaries/WASM/postinstall scripts
Transitive dependency count/weight
Known advisories and recent incidents
Bus-factor and replacement options
```

Use primary sources. Do not infer maintenance quality from download count alone.

### 4. Compatibility

Record:

- Node/browser/Angular/Nest/Python versions;
- ESM/CommonJS and tree-shaking;
- SSR/hydration/browser-only isolation;
- service worker/Web Worker/CSP/Trusted Types;
- mobile and low-end device behaviour;
- framework builder/test integration;
- generated-code or dynamic-import implications;
- container architecture/native binary support;
- peer dependency and version-lane constraints.

### 5. Product quality

For user-facing packages, record:

- keyboard and screen-reader behaviour;
- focus and focus return;
- 200% and 400% zoom/reflow;
- RTL and long translations;
- high contrast and non-colour semantics;
- reduced motion;
- touch/IME/mobile;
- unsupported/failure fallback;
- product visual customization through Relay/Spartan;
- whether an equivalent semantic representation is required.

A package's marketing accessibility statement is not test evidence.

### 6. Security and privacy

Record:

- untrusted inputs and dangerous outputs;
- authentication/authorization/RLS boundary;
- credentials and environment variables;
- data sent to package/vendor/provider;
- logging/telemetry exposure;
- stored local/private/admin data;
- supply-chain/native/WASM risk;
- sandbox, CSP and resource limits;
- SSRF, XSS, URL/deep-link, file/media parsing or command-injection risks;
- retention/deletion and user-switch behaviour;
- abuse/rate-limit/moderation considerations.

### 7. Architecture boundary

Define:

```text
Owning workspace/module
Application interface/facade
Allowed direct-import paths
Package-specific configuration owner
Persistence/API contract
Failure taxonomy
Feature flag and rollout owner
Observability
Removal path
```

### 8. Cost and performance

Measure or estimate with evidence:

- compressed and parsed bundle size;
- lazy versus initial chunk;
- memory/CPU/GPU/battery;
- network/storage/API/provider costs;
- build/install/CI time;
- container/native image size;
- worker throughput and queue implications;
- low-end device and poor-network behaviour;
- paid plan/service lock-in.

Do not invent exact provider cost/quota numbers when the provider does not expose them.

### 9. Tests

Define:

- unit tests through fake adapter;
- integration fixtures/service emulator;
- browser/component/accessibility tests;
- fault injection and timeout/cancellation;
- migration/backward compatibility;
- performance/bundle checks;
- ordinary CI credential requirements;
- optional real-provider smoke test gate.

Standard CI must not require live paid subscriptions, private media or production credentials.

### 10. Exit and rollback

Every package has:

```text
Adoption success criteria
Trial deadline or milestone
Explicit reject/remove criteria
Feature flag/kill switch
Data/API compatibility plan
Rollback procedure
Package removal procedure
Owner
```

## Trial lifecycle

### Stage 0: no package installed

Write the capability and decision record first. Use a draft branch or isolated spike where useful.

### Stage 1: isolated proof

- one adapter;
- one representative scenario;
- fake data and no production credentials;
- package not imported by unrelated features;
- build, test and bundle measurements;
- accessibility/security assessment.

### Stage 2: reference implementation

- one real feature behind a flag;
- stable application contract;
- telemetry and fault tests;
- migration/rollback;
- package-specific types still isolated.

### Stage 3: decision

The result is exactly one of:

```text
ADOPT
REJECT_AND_REMOVE
DEFER_AND_REMOVE
```

“Leave it installed in case we use it” is not an allowed trial outcome.

### Stage 4: rollout

Migrate by domain/category. Remove old implementation only after parity and compatibility evidence.

### Stage 5: convergence

- delete old package/code/config/assets;
- remove compatibility adapter after consumers move;
- update dependency register and architecture docs;
- tighten CI boundary checks;
- close/record trial decision.

## Package source and provenance policy

### Registry packages

- lock exact resolved versions through the lockfile;
- retain integrity hashes;
- use `npm ci`/`uv sync --locked` in CI and production builds;
- review lifecycle/postinstall scripts for high-risk packages;
- include production dependencies in SBOM and vulnerability review.

### Git, URL and tarball dependencies

Require explicit approval documenting:

- immutable commit/version URL;
- integrity verification;
- publisher/source authenticity;
- licence;
- update process;
- dependency-review/SBOM coverage;
- why the official registry package is unsuitable;
- removal/replacement trigger.

Floating branches and unauthenticated remote install scripts are prohibited in production builds.

### Native binaries and system tools

Examples include FFmpeg, Sharp/libvips, Podman and browser binaries.

Record:

- package/repository source;
- exact version/image digest;
- supported architectures;
- security update lane;
- runtime resource limits;
- licence and codecs/features;
- reproducible container installation;
- health/version diagnostics;
- SBOM/provenance treatment.

Do not interpolate user-controlled content into shell commands. Prefer argument arrays and bounded process execution.

### Hosted platforms and SDKs

A client SDK does not transfer product authority to a vendor.

Document:

- data residency and retention;
- credential model;
- outage/fallback semantics;
- rate/quota/cost limits;
- provider portability/adapter;
- deletion/export;
- vendor status/health integration;
- whether self-hosting exists and is required.

## Runtime versus development placement

### Runtime dependency

Use only when code loaded in production requires it.

Examples:

- Angular/Nest runtime;
- Supabase/LiveKit/Centrifugo clients;
- Sharp in media worker image;
- Pino;
- server Web Push/FCM adapters.

### Development dependency

Use for:

- compilers/builders;
- types;
- lint/format;
- tests and DOM emulators;
- generators;
- local tunnels;
- Storybook/Cypress/Playwright;
- migration/seed CLIs not present in runtime images.

A dynamic import at runtime is still a runtime dependency. Hoisting is not a declaration strategy.

### Worker-only dependency

Heavy processor/provider dependencies should live in the worker workspace/image once #7452/#7448 make that split real.

### Tool/agent dependency

Agent skills and Factory tooling must not enter product bundles/images. Tag/enforce module boundaries.

## Version policy

### Exact pin

Prefer exact pins for:

- Python Factory dependencies and tooling;
- generators and schema/code-producing CLIs;
- native binaries/images;
- high-risk preview/experimental trials;
- packages whose patch output can change persisted/generated artifacts.

### Compatible ranges

Accept ranges only where lockfiles still make builds deterministic and peer/security update policy is clear.

### Lockstep families

Update framework/plugin families coherently. Do not let Angular core/build/compiler/CDK or OpenHands SDK/tools drift independently without compatibility proof.

### Preview/alpha packages

Require:

- isolated adapter;
- feature flag;
- exit milestone;
- no core schema/public contract tied directly to preview types;
- stronger integration tests;
- explicit stable alternative/fallback.

## Unused-dependency analysis

### Knip

After npm workspaces and entry points are correct, configure Knip for:

- Angular/Nest/Vitest/Cypress/Playwright/Storybook;
- SSR and service-worker entry points;
- npm scripts and CLI binaries;
- dynamic imports/providers;
- generated clients/types;
- root design/conformance scripts;
- agent skill packages;
- load tests.

Use Knip findings as classified evidence:

```text
true unused
unlisted dependency
unused file/export
configuration gap
intentional dynamic/CLI use
compatibility migration
```

Do not auto-delete or hide findings under broad glob ignores.

### Python

Use import search, `uv tree`, lock checks, mypy/ruff/pytest and optional-provider tests. Host CLIs remain separate from Python package dependencies.

## CI gates

### Required immediately

- lockfile consistency;
- dependency review/vulnerability reporting;
- production SBOM;
- deterministic install;
- forbidden source specification check;
- generated client/database-type drift;
- no secrets/credentials committed;
- production image excludes obvious test/design packages.

### Introduce after baseline

- new direct dependency requires decision metadata and owner;
- new unused direct dependency fails changed workspace;
- unlisted dependency/unresolved import fails;
- package-boundary/deep-import rules;
- trial expiry check;
- version-lane drift;
- native binary/image digest/version check;
- bundle/container growth report and threshold for significant regressions.

### Scheduled

- full Knip report;
- vulnerability/licence/provenance/SBOM review;
- expired ignore/trial review;
- dependency family update simulation;
- package removal queue review;
- production container and lazy/initial bundle trends.

## Pull request rules

A dependency PR should be small enough to answer:

- what capability changed;
- what old code/package is replaced;
- which adapter owns the new package;
- what tests prove it;
- what persisted/public contract changed;
- what happens during outage/rollback;
- what package can now be removed.

Avoid PRs that simultaneously introduce unrelated UI, media, database, job and telemetry packages.

### Generated lockfiles

Lockfiles must be produced by the pinned package manager in a clean workspace. Do not hand-edit integrity/resolution data.

### Dependency-only updates

Run the owning capability's compatibility suite, not only `npm install` and lint.

Examples:

- LiveKit update: token, join/reconnect/share/device browser tests;
- Spartan update: CLI healthcheck, primitive stories, focus/RTL/zoom tests;
- Sharp update: image fixture/metadata/resource tests;
- Supabase update: auth/RLS/generated types/migration tests;
- OpenHands SDK update: Factory routing/state/worktree/review/doctor tests.

## Removal governance

### Removal trigger examples

- capability migrated to platform/native implementation;
- no runtime/config/script/generated consumer;
- trial rejected/deferred;
- duplicate wrapper consolidated;
- provider/service retired;
- framework deprecation removed;
- package replaced because security/maintenance is unacceptable.

### Removal checklist

1. Search imports, dynamic imports, configs, scripts, CI and Docker.
2. Inspect dependency tree and peer dependencies.
3. Remove package and lockfile entries through package manager.
4. Build every affected production target.
5. Run unit/integration/browser/fault tests.
6. Verify optional and lazy paths.
7. Compare bundle/container/SBOM.
8. Delete package-specific adapter/config/assets/types.
9. Update docs/register/ownership.
10. Keep compatibility only with an owner and expiry.

### Rollback

Rollback restores the package only when the old capability remains safe and compatible. It must not restore known unsafe semantics such as fictional success, custom weak MFA, source-as-translation, fake URLs or weakened authorization.

## Emergency security changes

For an actively exploitable dependency:

- disable/expose a kill switch where possible;
- patch/upgrade/remove with the smallest safe scope;
- preserve evidence and incident timeline;
- run targeted plus full required verification;
- update lockfile/SBOM/provenance;
- document temporary compatibility exception and expiry;
- follow with normal architecture cleanup.

Do not bypass reviewed-SHA, branch protection, OpenHands Factory verification or credential safety merely because the dependency incident is urgent.

## Coding-agent and Factory provider policy

The OpenHands Factory remains the orchestration authority. Claude, Codex, Google, OpenCode and OpenHands are interchangeable provider adapters beneath it.

The subscription-first architecture and safety requirements include:

- provider-neutral typed adapters;
- phase-specific routing;
- health, cooldown and concurrency;
- classified provider versus repository failures;
- independent review diversity;
- durable provider provenance;
- hardened non-interactive process execution;
- isolated worktrees and reviewed SHA;
- no credentials in prompts, GitHub comments, repositories or logs;
- ordinary CI uses fake providers and no subscription quota.

A provider CLI is added through one adapter, configuration and tests, not by modifying every Factory phase. Do not broadly mount a home directory or inherit API-key variables that can silently switch subscription execution to PAYG.

## Examples

### Doodle engine

**Capability:** smooth pressure-aware editable message doodles.  
**Decision:** adopt `perfect-freehand` for geometry behind repository stroke/document/history/upload APIs.  
**Not approved:** full whiteboard SDK unless classroom collaboration requirements pass the gate.  
**Issue:** #7465.

### Screen sharing

**Capability:** share screen/tab as a participant source.  
**Decision:** keep LiveKit native screen sharing and consolidate room/device/track state.  
**Not approved:** another WebRTC or screen-capture SDK.  
**Issue:** #7466.

### Recorded audio

**Capability:** voice note/audio intro/pronunciation recording and playback.  
**Decision:** keep native MediaRecorder, trial WaveSurfer for enhancement, add pinned FFmpeg/ffprobe worker and shared drafts/assets.  
**Not approved:** extension-based format claims or fake upload URL fallback.  
**Issue:** #7467.

### Hero animations

**Capability:** route/shared-element spatial continuity.  
**Decision:** progressive View Transition API behind one Angular adapter, native immediate fallback, Relay motion tokens.  
**Lottie:** one governed authored-animation adapter.  
**Rive:** bounded interactive state-machine trial only.  
**Issue:** #7469.

### Browser push

**Capability:** PWA push subscription and delivery.  
**Decision:** Angular SwPush plus standard Web Push/VAPID server adapter. Keep Firebase Admin only for native/platform delivery.  
**Remove candidate:** full browser Firebase package after proof.  
**Issue:** #7475.

## Ownership and review

Each package/capability has:

- product/domain owner;
- platform owner;
- security/privacy reviewer for high-risk inputs/providers;
- accessibility/design reviewer for user-facing interaction;
- operations owner for runtime services/workers;
- update/removal issue and documentation.

CODEOWNERS and Nx module boundaries should encode the stable parts of this ownership once #7452 lands.

## Policy review cadence

Review this policy and the register:

- after npm workspace/Nx convergence;
- after each major Angular/Nest/Supabase/OpenHands upgrade;
- after media/job/offline platform rollout;
- quarterly for expired trials/ignores and obsolete dependencies;
- after a material dependency/security incident;
- during the next repository-wide architecture audit.

## Definition of compliance

The repository complies when:

1. every direct dependency has a capability, owner and disposition;
2. new packages have a decision record and adapter boundary;
3. trials have a deadline and leave no abandoned dependency;
4. runtime/dev/worker/tool placement is correct;
5. install/builds are deterministic and locked;
6. provenance, licence, vulnerability and SBOM coverage include production dependencies;
7. user-facing packages pass accessibility/i18n/failure/performance gates;
8. provider/media/content/location dependencies have explicit privacy/security policy;
9. removal PRs include runtime/build/test evidence;
10. OpenHands Factory provider credentials and subscription execution remain isolated from product dependency/build systems;
11. documentation and CI describe the implementation on `main`, not an aspirational package list.
