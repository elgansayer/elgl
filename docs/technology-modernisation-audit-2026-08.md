# Technology modernisation audit

**Repository:** `elgansayer/elgl`  
**Audit date:** 2026-08-19  
**Tracking issue:** #7458

## Executive conclusion

The repository does not need a fashionable framework rewrite. It has already crossed several of the migrations that would normally be the first recommendations:

- the main web application and the separate admin portal are Angular 22 applications;
- the backend is a large NestJS 11 modular monolith;
- the main frontend already uses Tailwind 4 and Spartan NG;
- Supabase is the identity, Postgres, storage and row-level-security platform;
- Centrifugo and LiveKit already cover realtime messaging/presence and audio/video rooms;
- the OpenHands Factory already has provider adapters, routing, health and process-management modules.

The best return is therefore not Angular instead of JavaScript, React instead of Angular, or a new backend framework. The best return is to replace the bespoke infrastructure wrapped around the existing foundations.

The highest-value changes are:

1. remove fabricated runtime authentication and move mocks to test infrastructure;
2. replace custom TOTP and client-only WebAuthn with an authoritative MFA/passkey platform;
3. generate the Angular API client from the Nest OpenAPI contract;
4. move durable background work from process-local intervals/events to BullMQ;
5. make one Supabase migration history and generated database types authoritative;
6. consolidate the many raw IndexedDB implementations on Dexie and one durable outbox;
7. replace the custom SM-2 scheduler with a versioned `ts-fsrs` adapter and immutable review logs;
8. introduce npm workspaces and Nx incrementally so shared libraries and affected CI are real rather than simulated with scripts;
9. finish Spartan adoption and share the Relay/Spartan UI layer with the admin portal;
10. make Storybook, Vitest browser tests and axe the executable component catalogue;
11. standardise server and worker telemetry on OpenTelemetry/OTLP;
12. establish a clear Angular state architecture using generated clients, resources, NgRx SignalStore and Dexie at their correct boundaries;
13. remove the deprecated Angular animations provider before Angular 23.

The detailed implementation work is tracked in #7445 through #7457 and coordinated by #7458.

## Scope and method

This audit inspected:

- root, frontend, backend and admin package manifests;
- Angular bootstrap/configuration and representative services/stores;
- Nest bootstrap, modules, guards, workers, cron tasks and database access;
- Supabase and backend migration locations;
- the owned Spartan Helm layer, Relay component-system contract and admin styles;
- the offline/cache services using IndexedDB;
- SRS scheduling and offline review handling;
- the OpenHands Factory provider architecture;
- open issues to avoid duplicating work already owned elsewhere.

Recommendations were accepted only where at least one of these conditions is true:

- the repository has implemented a security-sensitive protocol itself;
- process-local state is being treated as durable or distributed state;
- the same infrastructure is implemented repeatedly across domains;
- generated contracts can replace hand-maintained duplicate types and URLs;
- an upstream framework deprecation creates a near-term upgrade blocker;
- an existing maintained package offers materially stronger correctness, accessibility or operational behaviour;
- the change unlocks multiple other backlog items.

A package is not recommended simply because it is popular.

## Current architecture baseline

### Web application

The main frontend is already a modern Angular application. It uses Angular 22, TypeScript 6, standalone configuration, signals, Tailwind 4, Spartan NG, Supabase, Centrifuge, LiveKit, Chart.js, Firebase messaging, DOMPurify and extensive Vitest/Cypress checks.

This means the correct UI direction is:

```text
Angular 22
  + Relay semantic design tokens
  + Spartan Brain accessibility/behaviour
  + repository-owned Spartan Helm source
  + shared product patterns
```

It is not:

```text
replace Angular with React/Vue/Svelte
replace Spartan with another component suite
replace repository-owned Helm with an opaque theme package
```

### Admin portal

The admin portal is also Angular 22, but it is materially less integrated. It has a separate manifest, hand-written API services and a global SCSS design system with hard-coded colours and bespoke card/navigation/form styles. It does not currently consume the main Relay/Spartan primitive layer.

The separate deployment and security boundary is valuable. The separate visual and transport implementations are not.

### Backend

The backend is a NestJS 11 modular monolith with Supabase, Redis/ioredis, scheduled jobs, EventEmitter2, Pino, Prometheus/StatsD-style metrics, Stripe and many product domains.

NestJS remains a good fit because the problem is domain breadth and platform consistency, not lack of framework structure. The main backend problems are below the framework layer:

- mixed migration authorities;
- direct Supabase calls with duplicated types;
- in-process events and polling used for durable work;
- fragmented observability;
- custom authentication-assurance code.

### Realtime and calls

Centrifugo and LiveKit solve different hard problems and should stay:

- Centrifugo provides realtime fan-out, presence and messaging transport;
- LiveKit provides WebRTC media rooms and lifecycle primitives.

Replacing either with hand-written Socket.IO/WebSocket/WebRTC code would increase operational and security burden without evidence of a product gain.

### Autonomous engineering factory

The current OpenHands Factory already contains an `agents/` package with provider-neutral base types plus Claude, Codex, Google, OpenCode and OpenHands adapters, routing policy, health tracking and a hardened process layer.

That architecture should be preserved. The Factory remains the scheduler, worktree owner, verifier, reviewer and merge-safety authority. Provider CLIs remain interchangeable execution engines underneath it.

Future work should audit completeness, tests, state migration and production diagnostics rather than revive the old swarm or replace the Factory with a single vendor CLI.

## Decision principles

### Prefer one authority per concern

Examples:

- Supabase Auth owns session assurance and factors.
- Nest OpenAPI owns HTTP transport contracts.
- Supabase migrations own the Postgres schema history.
- BullMQ owns durable Redis-backed background-job state.
- Dexie owns browser IndexedDB access.
- Spartan Brain owns primitive interaction/accessibility behaviour.
- Relay tokens own product visual meaning.
- OpenTelemetry owns instrumentation semantics and OTLP export.

Application code still owns product rules. It should not own protocol ceremonies, queue leasing, IndexedDB plumbing or generated transport DTOs.

### Preserve product boundaries while replacing infrastructure

A replacement should sit behind a typed adapter so product code is not rewritten around vendor-specific APIs. Examples include `SrsScheduler`, generated API facades, offline repositories, job contracts and telemetry interfaces.

### Migrate vertically, not by flag-day

Each recommendation includes a reference implementation, compatibility boundary, shadow or dual-read period where required, measurable parity and rollback.

### Do not confuse copied source with home-brew behaviour

Spartan Helm is intentionally copied into the repository and styled locally. That is not the same as inventing dialog, popover, menu, select or focus-management behaviour. Repository ownership of Helm visuals is correct; duplicating Brain behaviour in feature code is not.

## Prioritised recommendation matrix

| Priority | Current implementation | Recommended platform/package | Primary value | Main risk | Issue |
|---|---|---|---|---|---|
| P0 | Runtime fabricated user/session | MSW and explicit test providers | Fail-closed auth; realistic fixtures | Tests relying on implicit mock identity | #7445 |
| P0 | Custom TOTP plus client-only WebAuthn | Supabase MFA/AAL and passkeys | Correct challenge verification and server enforcement | User-factor migration | #7446 |
| P0 | Hand-written Angular HTTP services/DTOs | Nest OpenAPI + OpenAPI Generator `typescript-angular` | Contract consistency and generated clients | Incomplete OpenAPI metadata | #7447 |
| P0 | `setInterval`, cron and in-process durable side effects | `@nestjs/bullmq` + BullMQ | Durable retries, distributed workers and visibility | Idempotency and backlog migration | #7448 |
| P0 | Supabase and TypeORM migration histories | Supabase CLI migrations + generated DB types | One schema authority | Reconciling deployed history | #7449 |
| P0 | Many raw IndexedDB databases/queues | Dexie + one typed offline/outbox layer | Transactional, versioned offline data | Legacy data migration and privacy | #7450 |
| P1 | Bespoke mutable SM-2 scheduling | `ts-fsrs` + immutable review log | Maintained scheduler and reproducibility | Workload/retention changes | #7451 |
| P1 | Manual multi-project scripts and manifests | npm workspaces + Nx | Shared libraries, boundaries, affected CI | Build/cache misconfiguration | #7452 |
| P1 | Partial Spartan use; bespoke admin styling | Shared Relay/Spartan Helm library | Accessibility and design consistency | Broad visual regression surface | #7453 |
| P1 | Custom visual matrix/catalog tooling | Storybook Angular Vite + Vitest browser + axe | Executable component catalogue | Angular Vite integration is preview | #7454 |
| P1 | Pino, Prometheus, StatsD and custom correlation islands | OpenTelemetry/OTLP | End-to-end traces/metrics and vendor-neutral export | Cardinality/privacy/overhead | #7455 |
| P1 | Bespoke signal stores mixing transport/offline/UI concerns | `httpResource`/`rxResource` + NgRx SignalStore | Clear state ownership and cancellation | Over-centralising state | #7456 |
| P1 | Deprecated Angular animations provider | Native CSS + `animate.enter`/`animate.leave` | Angular 23 readiness and smaller runtime | Overlay/focus timing regressions | #7457 |

## Detailed findings and replacements

### 1. Runtime mock authentication must move out of production services

`frontend/src/app/services/auth.service.ts` creates a mock user and mock session whenever Supabase has no real session. It also repeats that fallback after auth-state changes.

This is not a harmless demo fixture. It changes the meaning of “unauthenticated” in ordinary runtime code and can hide:

- missing protected-route handling;
- API calls sent with a fabricated bearer token;
- authenticated-content flashes during startup;
- authorization tests that pass because a user always exists;
- production configuration mistakes.

**Replacement:** Mock Service Worker plus explicit test/demo providers.

MSW is preferable to service-specific fake methods because the same request-level fixtures can be reused by Vitest, Storybook and browser tests. Production bootstrap must never start MSW or fabricate a privileged identity.

**Decision:** execute #7445 before broad frontend-store or auth-flow refactors.

### 2. Authentication assurance should be owned by Supabase

The custom TOTP service stores application-owned secrets and the frontend’s biometric flow performs a WebAuthn ceremony without a trusted server challenge or signature-verification authority.

A valid primary Supabase session is obtained before the custom second factor. That forces every API, RLS policy and frontend route to understand a second, application-specific assurance state. It is easy for one path to forget.

**Replacement:** Supabase MFA factor APIs, JWT authenticator assurance levels and server-verified passkeys behind a feature flag.

Sensitive operations should require `aal2` in both the Nest authorization layer and relevant RLS policies. A local device privacy screen may remain, but it must not be called authentication or authorize server actions.

If Supabase passkeys remain unsuitable after the experimental integration is evaluated, the fallback should be a real server verifier such as `@simplewebauthn/server`, not another client-only ceremony.

**Decision:** execute #7446 as a security migration with dual-read/recovery support.

### 3. The existing OpenAPI document should generate both Angular clients

The backend already creates a Swagger/OpenAPI document. The main frontend and admin portal nevertheless hand-maintain endpoint strings, DTOs, bearer headers and response shapes.

This causes contract work to be repeated in nearly every feature issue. It also creates silent drift around pagination, file uploads, validation errors and optional fields.

**Replacement:** pin OpenAPI Generator and generate a shared `typescript-angular` workspace library.

Hand-written facades should remain only where they add domain value such as caching, orchestration, state mapping or offline integration. They should not redefine transport DTOs or URLs.

The contract must first be made deterministic and linted. Stable operation IDs, error envelopes and file schemas are prerequisites.

**Decision:** execute #7447; migrate the small admin clients first, then main-frontend domains.

### 4. Durable work needs a real queue substrate

The backend currently combines:

- Nest cron jobs;
- EventEmitter2 listeners;
- domain-specific retry/degraded queues;
- polling workers using `setInterval` and process-local boolean locks.

These patterns can work in one process, but they do not establish durable leases, distributed ownership or restart-safe retries. Multiple API replicas can duplicate cron work, and process exit can lose in-process side effects.

**Replacement:** official Nest BullMQ integration using the existing Redis platform.

BullMQ should cover work that must survive restarts, be delayed, retried, inspected, rate-limited or processed outside the API. EventEmitter2 should remain for synchronous/local notifications where loss is explicitly acceptable.

Job payloads must be versioned and idempotent. The delivery model is at least once, not exactly once. Database changes that must atomically produce a job require an outbox or equivalent reconciliation mechanism.

**Decision:** execute #7448 and implement existing dead-letter issue #3503 on that substrate.

### 5. The database needs one migration and type authority

The repository has SQL under `supabase/migrations/` and another migration/entity history under `backend/src/database/`. Runtime services predominantly use the Supabase query builder directly.

Two histories create ambiguity over:

- which migrations production actually applies;
- ordering and duplicate changes;
- RLS/grant/function ownership;
- clean local reset;
- generated types;
- rollback and drift.

**Replacement:** Supabase CLI-managed migrations as the only deployable schema history, optionally with declarative schema files after a proof of concept, plus generated TypeScript `Database` types.

TypeORM should be removed if runtime evidence confirms it is only a second migration/entity metadata layer. If complex server transactions need typed SQL, introduce a narrow repository using generated Supabase types, RPC/database functions or Kysely for those paths. Kysely must not become another migration authority.

**Decision:** execute #7449 and coordinate with the generated-type stages already present in #5365.

### 6. Browser offline data needs one typed database and outbox

Raw IndexedDB access is repeated across general caches, chat, SRS, crash reporting, saved content, escrow, reading, classrooms, moderation, economy, discovery and admin storage.

Each service separately implements database opening, versions, object stores, promise wrappers, retention and sync queues. That creates a system-wide migration and privacy problem.

**Replacement:** Dexie plus a repository-owned offline platform.

The platform should provide:

- explicit schema versions and migrations;
- per-user partitioning and purge lifecycle;
- bounded caches;
- a transactional outbox with operation IDs and payload versions;
- cross-tab leasing;
- quota/degraded-state handling;
- domain-specific conflict policies;
- privacy classification and retention.

Dexie Cloud is not implied. The open-source local IndexedDB wrapper is sufficient.

Admin/moderation data should default to not being persisted offline unless a documented operational requirement and risk review justify it.

**Decision:** execute #7450, with SRS as the reference migration.

### 7. SRS scheduling should use a maintained algorithm behind a versioned adapter

The backend implements SM-2 and stores mutable scheduler fields. It also has process-memory degradation behaviour. Offline reviews introduce replay and timestamp correctness requirements.

**Replacement:** `ts-fsrs` behind an application-owned `SrsScheduler`, with append-only review events and derived current card state.

This is not a blind algorithm swap. The migration requires:

- golden tests for current behaviour;
- explicit rating mapping;
- original review timestamps from offline clients;
- idempotency keys;
- shadow computation;
- cohort rollout;
- scheduler and parameter versioning;
- deterministic replay and undo;
- workload/retention-proxy comparison.

The optional FSRS optimizer should be evaluated only after enough high-quality review history exists and privacy/product policy permits it.

**Decision:** execute #7451 after the schema and offline foundations are defined.

### 8. The repository has become a monorepo without monorepo tooling

Root scripts manually enter subdirectories. Package versions and lockfiles are split. Shared UI, API and database-type libraries have no natural home. CI has to rediscover affected scope through custom scripts.

**Replacement:** npm workspaces and incremental Nx adoption.

Start package-based. Do not move every directory to `apps/` and `libs/` in the first change. Register existing commands as targets, preserve compatibility scripts, build a project graph and then extract only proven shared libraries.

Nx is preferred over a generic task runner here because it has first-party Angular support, project tagging, module-boundary rules, affected tasks and migrations. Turborepo would improve task caching but would not address Angular-aware generators or dependency boundaries as directly.

Remote Nx Cloud is optional. Local cache and affected CI must work without a paid service, and cached inputs/outputs must not include secrets.

**Decision:** execute #7452 incrementally.

### 9. Spartan adoption is real but incomplete

The frontend already has Spartan Brain/CLI and an owned Helm directory. The correct next step is not “install Spartan”; it is to make the existing contract true across all surfaces.

Current gaps include:

- the owned Helm README does not match the actual directory;
- the installed primitive surface remains small relative to product needs;
- feature-level bespoke controls can still appear;
- the admin portal uses a separate hard-coded global style system;
- the two Angular applications cannot consume one governed UI package.

**Replacement:** one workspace library containing Relay tokens and owned Spartan Helm source, consumed by web and admin.

Use the official Spartan `info` and `healthcheck` commands to cover upstream invariants. Retain Relay-specific checks for semantic tokens, translation safety, RTL, high zoom, density and design-sync policy.

Do not install every Spartan component. Add primitives when repeated product behaviour proves the need.

**Decision:** execute #7453.

### 10. Component documentation and browser behaviour should be executable

The repository has many bespoke conformance checks, visual-matrix components and narrow specs. They are valuable but do not form one discoverable catalogue that shares fixtures across documentation, interaction, accessibility and visual regression.

**Replacement:** pilot Storybook Angular Vite, the Vitest addon/browser mode, axe accessibility checks and deterministic visual snapshots.

The Angular Vite Storybook integration is currently preview, so the issue contains a real go/no-go gate. If it is unreliable, keep portable stories/fixtures and run them through a small Playwright gallery until the supported integration is ready.

Storybook does not replace journey E2E tests or static Relay architecture checks.

**Decision:** execute #7454 after a five-component pilot.

### 11. Telemetry should share one context and export boundary

Pino, `prom-client`, StatsD/hot-shots, custom aggregators and ad-hoc correlation fields provide useful pieces, but not one request-to-job trace or one vendor-neutral instrumentation contract.

**Replacement:** OpenTelemetry Node SDK plus OTLP, preserving Pino and Prometheus compatibility during migration.

The initial scope is backend and workers. Browser OpenTelemetry should not block the work because its maturity and value differ from Node instrumentation.

Critical requirements are:

- initialize before Nest modules load;
- bound cardinality;
- never attach messages, prompts, tokens, OTPs or row payloads by default;
- propagate context into BullMQ jobs;
- correlate Pino logs with trace/span IDs;
- isolate exporter failure from product requests;
- maintain dashboard/alert parity before removing existing emitters.

**Decision:** execute #7455, coordinating queue context with #7448.

### 12. Signals need architecture, not just syntax

Representative stores combine endpoint construction, auth headers, DTO definitions, sanitisation, request execution, caching, offline persistence, domain calculations, UI classes and status flags.

**Replacement:** use the lightest Angular state mechanism for each state class:

- component signals for local UI state;
- route/query parameters for navigable state;
- `httpResource` or `rxResource` for reactive reads;
- NgRx SignalStore for shared feature/domain state and mutation workflows;
- RxJS for streams and cancellation where it remains natural;
- Dexie repositories for intentional persistence/offline state;
- generated clients for transport.

This is not a recommendation for one global Redux store. It is a recommendation to stop every service inventing its own server-cache and mutation semantics.

**Decision:** execute #7456 after the API/offline boundaries exist; use vocabulary/SRS as the reference domain.

### 13. Angular animations are now technical debt with a deadline

The frontend registers `provideAnimations()` and declares `@angular/animations`. Angular deprecated the provider/package and intends to remove the provider in Angular 23.

**Replacement:** native CSS transitions/keyframes, Angular `animate.enter`/`animate.leave` and the Web Animations API only where imperative control is required.

The migration must preserve focus return, overlay teardown, reduced motion, SSR/hydration and interaction readiness.

**Decision:** execute #7457 before the Angular 23 upgrade.

## Existing work that should not be duplicated

### #3503: dead-letter jobs

#3503 already specifies dead-letter behaviour for exhausted BullMQ jobs. It should become a child of the queue platform rather than spawning another queue implementation.

### #5365: CI/testing hardening

#5365 already owns:

- generated Supabase type and migration CI stages;
- Cypress/Playwright coverage inventory and duplicate-flow removal;
- browser E2E, accessibility, visual and production-build testing;
- broader dependency and workflow hardening.

The modernisation programme should provide shared platforms and let #5365 retain testing-governance ownership.

### OpenHands Factory routing

The repository already has the provider-neutral agent package requested by the Factory architecture: adapters, policy, router, health and process management. Any remaining Factory gaps should be derived from current tests and production diagnostics, not from the assumption that routing has not been implemented.

## Technologies to keep

| Technology | Decision | Reason |
|---|---|---|
| Angular 22 | Keep | Both web applications already use it; strong native signals/resources and first-party tooling |
| NestJS 11 | Keep | Domain modularity and guards/interceptors fit the large backend |
| Supabase | Keep and make authoritative | Auth, Postgres, storage and RLS are deeply integrated |
| Spartan NG | Keep and complete | Accessible behaviour plus repository-owned visual source matches Relay needs |
| Tailwind 4 | Keep | Already integrated with the main component system |
| Centrifugo | Keep | Avoid rebuilding realtime fan-out/presence |
| LiveKit | Keep | Avoid rebuilding WebRTC media infrastructure |
| Redis/ioredis | Keep | Existing platform can support BullMQ and caching/rate limits |
| Pino | Keep | Structured application logging remains useful with trace correlation |
| DOMPurify | Keep at rendering boundaries | Mature sanitisation is preferable to custom HTML filtering |
| `class-validator`/Nest validation | Keep for inbound DTOs | No benefit from a flag-day schema-library rewrite |
| Chart.js | Keep | No evidence that chart rendering is a bottleneck or product limitation |
| OpenHands Factory | Keep and harden | It already owns orchestration/safety and now has multi-provider adapters |

## Wholesale migrations explicitly rejected for now

### Angular to React, Vue, Svelte or another frontend framework

Rejected. The repository already has Angular 22, extensive tests, signals, SSR/hydration work, route architecture and Spartan components. A rewrite would consume years of feature effort while leaving the actual infrastructure problems untouched.

### NestJS to Hono, Fastify-only, Bun or another backend framework

Rejected as a wholesale migration. Performance should be measured first. Nest can change HTTP adapters or isolate hotspots without discarding modules, guards, DTOs and tests.

### Supabase to Prisma/Drizzle as the universal data layer

Rejected. The key problem is split authority, not lack of an ORM. A blanket ORM could obscure RLS, grants, functions and query plans while creating another migration system. Kysely is a conditional adapter for complex typed transactions only.

### Centrifugo to Socket.IO or custom WebSockets

Rejected. It would recreate presence, fan-out, reconnect and scaling concerns already delegated to a specialised service.

### LiveKit to custom WebRTC

Rejected. Media negotiation, TURN, recording, device handling and room operations are not product differentiation worth owning.

### Modular monolith to microservices/Kafka

Rejected until there is measured organisational or scaling pressure that cannot be solved by separate workers and module boundaries. The immediate distributed-system need is durable background processing, not dozens of deployables.

### BullMQ to Temporal immediately

Rejected for the current worker set. Temporal becomes appropriate when the product has multi-day workflows, human approval, compensating multi-service sagas or durable orchestration whose state cannot be expressed safely as jobs. BullMQ is a lower-complexity fit for the observed work.

### Nest/OpenAPI to tRPC

Rejected. OpenAPI already exists, supports both Angular applications and remains suitable for external/admin integrations. Replacing it would discard a standard contract and couple clients tightly to server TypeScript internals.

### Spartan full-stack/AnalogJS adoption

Rejected. Spartan’s UI primitives fit; its optional full-stack stack is unrelated to the existing mature Nest/Supabase architecture.

### One global NgRx Store

Rejected. SignalStore should be feature-scoped and resources should own request-driven reads. Local state should remain local.

### Dexie Cloud

Not implied. The recommendation is the open-source Dexie IndexedDB layer. Cloud sync would require a separate product, privacy and vendor review.

### Browser-wide OpenTelemetry as a prerequisite

Rejected. Server and worker telemetry offers immediate correlation value. Browser RUM/error monitoring can be evaluated independently.

## Conditional technology watchlist

These are not approved migrations. They have explicit triggers.

| Candidate | Evaluate only when | Notes |
|---|---|---|
| Temporal | Workflows span hours/days, human approval or compensating multi-service sagas | Compare operational cost against BullMQ before adoption |
| OpenFeature + Unleash/other provider | Feature flags proliferate across frontend/backend and vendor coupling appears | OpenFeature can preserve a provider-neutral API |
| Typesense or Meilisearch | Postgres search cannot meet measured relevance, typo tolerance or latency targets | Keep Postgres authoritative; index asynchronously |
| Kysely | Complex server transactions/RPCs remain difficult to type and test | Never give it a second migration history |
| XState | The same complex UI/workflow state machines repeatedly produce invalid transitions | Use locally, not as a universal state store |
| `@simplewebauthn/server` | Supabase passkeys cannot satisfy required production guarantees | Use only with real server challenge persistence/verification |
| Knip | Unused dependency/export detection remains noisy after workspaces are established | Integrate into #5365 dependency governance rather than create another gate immediately |
| Sentry, Honeycomb, Grafana or another backend | A telemetry destination is selected | Prefer OTLP export so instrumentation remains portable |
| PGlite | A real browser-local SQL/query use case exceeds Dexie capabilities | Do not adopt for ordinary caches/outboxes |

## Package-governance observations

The manifests currently span root, frontend, backend, admin, E2E and load-test projects. This creates version divergence and multiple lockfiles. Before adding more libraries:

1. establish one workspace install and dependency ownership;
2. pin tool versions used to generate code or migrations;
3. document experimental dependencies and an exit condition;
4. require an adapter for vendor-specific infrastructure;
5. measure bundle/runtime/CI impact;
6. add a removal plan for replaced dependencies;
7. keep generated code deterministic;
8. coordinate dependency-pruning work with #5365.

Experimental or preview technologies in this programme are deliberately isolated:

- Supabase passkeys: feature-flagged adapter and recovery path;
- Storybook Angular Vite: pilot with go/no-go and fallback;
- FSRS parameter optimization: separate later evaluation;
- declarative Supabase schemas: proof of concept before becoming authoritative.

## Recommended execution sequence

### Wave 0: stop unsafe assumptions

1. #7445 remove runtime mock authentication.
2. #7446 establish authoritative MFA/AAL enforcement.
3. Start #7449 schema-history inventory.
4. Start #7447 OpenAPI contract quality gate.

### Wave 1: create shared platform boundaries

1. #7452 introduce npm workspaces and Nx metadata without moving source.
2. #7449 establish Supabase migration/type authority.
3. #7447 generate the shared Angular SDK.
4. #7448 add BullMQ and migrate one worker.
5. #7450 add Dexie and migrate SRS offline storage.
6. #7455 initialise OpenTelemetry and HTTP/log correlation.

These can run in parallel when they do not modify the same manifests or shared bootstrap files. Integration order must be coordinated explicitly.

### Wave 2: migrate representative domains

1. #7453 shared Relay/Spartan library and admin reference screen.
2. #7454 Storybook pilot and primitive catalogue.
3. #7456 vocabulary/SRS store reference migration.
4. #7451 FSRS shadow computation and immutable review log.
5. #7457 remove deprecated animations after overlay tests exist.

### Wave 3: converge and remove

- migrate remaining HTTP clients, stores, offline services and jobs by domain;
- remove TypeORM migration authority and unused packages;
- remove legacy IndexedDB stores after a compatibility window;
- remove legacy TOTP/WebAuthn code and secret columns;
- remove duplicated visual/E2E tooling only after coverage mapping;
- update architecture, operations and contributor docs continuously.

## Cross-cutting acceptance requirements

Every migration PR must address:

### Security and privacy

- no credentials, JWTs, OTPs, messages, prompts or private rows in logs/traces/fixtures;
- server-side authorization remains authoritative;
- RLS regression tests cover direct database access;
- offline data has user partitioning, retention and purge semantics;
- generated clients/types contain no environment-specific secrets;
- queue and browser payloads are treated as untrusted input.

### Reliability

- idempotency is explicit for retries and offline replay;
- shutdown and restart behaviour is tested;
- no process-local state is treated as durable;
- migrations support mixed versions where feasible;
- feature flags and rollback restore a coherent prior state.

### Accessibility

- Spartan/Relay primitives preserve keyboard, focus, screen-reader and high-zoom behaviour;
- important state is not colour-only;
- reduced motion, RTL and long translations are part of component coverage;
- admin destructive actions have consistent confirmation and feedback.

### Observability

- important transitions have bounded, sanitised logs/metrics/traces;
- failures can be correlated without database access;
- dashboards and alerts move before old telemetry is removed;
- migration progress and legacy fallback use are measurable.

### Testing

- reference migrations include unit, integration and browser coverage;
- generated artifacts are checked for drift;
- contract/schema migrations run from a clean environment;
- old and new behaviour can be compared during shadow/dual-read periods;
- standard CI never consumes real subscription-agent credentials.

## Repository evidence map

The most relevant inspected paths are:

```text
package.json
frontend/package.json
backend/package.json
admin-portal/package.json

frontend/components.json
frontend/src/app/app.config.ts
frontend/src/app/services/auth.service.ts
frontend/src/app/services/api.service.ts
frontend/src/app/services/vocabulary.store.ts
frontend/src/app/services/srs-offline.service.ts
frontend/src/app/components/ui/
admin-portal/src/app/
admin-portal/src/styles.scss

backend/src/main.ts
backend/src/app.module.ts
backend/src/two-factor/
backend/src/admin/guards/admin-capability.guard.ts
backend/src/escrow/escrow-queue.worker.ts
backend/src/flashcards/flashcards.service.ts
backend/src/database/migrations/
backend/src/metrics/
supabase/migrations/

automation/openhands_factory/
automation/openhands_factory/agents/
docs/factory/

docs/component-system-convergence.md
docs/architecture_audit.md
```

## Issue index

| Issue | Deliverable |
|---|---|
| #7445 | Fail-closed production auth and MSW fixtures |
| #7446 | Supabase MFA/AAL/passkey migration |
| #7447 | Generated Angular API SDK |
| #7448 | BullMQ job platform |
| #7449 | One Supabase schema/migration/type authority |
| #7450 | Shared Dexie offline platform |
| #7451 | Versioned FSRS scheduler and review log |
| #7452 | npm workspaces and Nx |
| #7453 | Shared Relay/Spartan UI library |
| #7454 | Storybook/browser/a11y component catalogue |
| #7455 | OpenTelemetry/OTLP correlation |
| #7456 | Angular resources and SignalStore architecture |
| #7457 | Native CSS animation migration |
| #7458 | Programme tracking and dependency coordination |

Related existing work:

- #3503: dead-letter path for exhausted jobs;
- #5365: CI/testing hardening, generated database types/migration checks and Cypress/Playwright convergence.

## Primary external references

- Angular resources: <https://angular.dev/api/common/http/httpResource>
- Angular RxJS resource: <https://angular.dev/api/core/rxjs-interop/rxResource>
- Angular animations migration: <https://angular.dev/guide/animations/migration>
- Angular `provideAnimations` deprecation: <https://angular.dev/api/platform-browser/animations/provideAnimations>
- NgRx SignalStore: <https://ngrx.io/guide/signals/signal-store>
- Spartan introduction: <https://www.spartan.ng/documentation/introduction>
- Spartan CLI and health checks: <https://www.spartan.ng/documentation/cli>
- Storybook Angular Vite: <https://storybook.js.org/docs/get-started/frameworks/angular-vite>
- Storybook accessibility testing: <https://storybook.js.org/docs/writing-tests/accessibility-testing>
- Mock Service Worker: <https://mswjs.io/>
- Nest OpenAPI: <https://docs.nestjs.com/openapi/introduction>
- OpenAPI Generator Angular client: <https://openapi-generator.tech/docs/generators/typescript-angular/>
- Nest queues: <https://docs.nestjs.com/techniques/queues>
- BullMQ: <https://docs.bullmq.io/>
- Dexie: <https://dexie.org/>
- Supabase MFA: <https://supabase.com/docs/guides/auth/auth-mfa>
- Supabase passkeys: <https://supabase.com/docs/guides/auth/passkeys>
- Supabase local development/migrations: <https://supabase.com/docs/guides/local-development>
- Supabase environments: <https://supabase.com/docs/guides/deployment/managing-environments>
- OpenTelemetry Node.js: <https://opentelemetry.io/docs/languages/js/getting-started/nodejs/>
- `ts-fsrs`: <https://github.com/open-spaced-repetition/ts-fsrs>
- Nx Angular: <https://nx.dev/docs/technologies/angular/introduction>

## Final recommendation

Treat #7458 as a programme of infrastructure substitutions, not a rewrite programme.

The repository should become more conventional at the boundaries and remain differentiated in the product:

```text
Buy/adopt protocol and platform machinery.
Generate contracts and types.
Own language-learning, community and trust product rules.
Keep Angular, NestJS, Supabase, Spartan, Centrifugo, LiveKit and OpenHands.
Remove the parallel mini-platforms built around them.
```
