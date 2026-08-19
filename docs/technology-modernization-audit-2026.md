# Technology Modernization Audit

**Audit date:** 2026-08-19  
**Repository snapshot:** `main` at `8a8805134ac2aa65ee1a400dfb9634fbcd87ea63`  
**Scope:** application frameworks, component systems, packages, API contracts, data access, background work, realtime/media, authentication, observability, testing, build tooling, platform targets, automation, and supply-chain governance.

This is a static architecture and dependency audit. It is based on repository source, manifests, workflows, documentation, and the active GitHub backlog. Runtime performance, production traces, database query plans, bundle composition, and operating cost were not measured as part of this document. Any recommendation that depends on those measurements is explicitly classified as a trial or assessment rather than an immediate replacement.

## Executive decision

The repository does **not** need a broad framework rewrite.

The main user application is already Angular 22 rather than unstructured JavaScript. Spartan is already installed and governed. The backend is already NestJS 11. Supabase/PostgreSQL, Centrifugo, LiveKit, Redis, Cloudflare R2, Vitest, Cypress, Pino, Prometheus-compatible metrics, and the provider-neutral OpenHands Factory each solve distinct, defensible concerns.

The largest near-term gains come from reducing drift and duplicated contracts around the existing architecture:

1. Make the Supabase schema and migration path authoritative, generate database types, and retire the split TypeORM migration path when the runtime inventory proves that it is safe. See [#7449](https://github.com/elgansayer/elgl/issues/7449).
2. Repair npm lockfile drift, introduce npm workspaces, and benchmark Nx before adopting its task graph or cache broadly. See [#7441](https://github.com/elgansayer/elgl/issues/7441).
3. Remove Angular APIs already deprecated ahead of Angular 23. See [#7442](https://github.com/elgansayer/elgl/issues/7442).
4. Establish a deterministic, governed OpenAPI artifact. See [#7443](https://github.com/elgansayer/elgl/issues/7443).
5. Generate shared Angular SDKs from that contract and remove hand-written transport duplication incrementally. See [#7447](https://github.com/elgansayer/elgl/issues/7447) and [#3876](https://github.com/elgansayer/elgl/issues/3876).
6. Replace custom authentication-assurance mechanisms with Supabase MFA/passkey flows and server-enforced assurance levels. See [#7446](https://github.com/elgansayer/elgl/issues/7446).
7. Continue the existing Relay/Spartan convergence program. Do not replace Relay presentation ownership with generic component skins.
8. Trial Storybook only as a bounded component-workshop experiment. Keep route-level Cypress visual capture authoritative unless measurements justify a change. See [#7444](https://github.com/elgansayer/elgl/issues/7444).

## Architecture principles for technology selection

A new library should enter the repository only when it removes more complexity than it adds. Prefer a candidate when it:

- replaces duplicated application-owned infrastructure;
- creates one authoritative contract or state owner;
- improves accessibility, security, testability, failure recovery, or observability;
- integrates with Angular 22, NestJS 11, SSR/hydration, Supabase, and the existing CI contract;
- can be introduced behind a narrow adapter and rolled back;
- has a maintained upstream, a clear licence, deterministic installation, and a credible upgrade path;
- has measurable success criteria.

Reject or defer a candidate when it:

- duplicates an existing capability without a migration/removal plan;
- requires a flag-day rewrite;
- weakens RLS, server-side authorization, Factory safety, or visual/accessibility gates;
- moves ownership into generated or vendor-specific code that the application cannot govern;
- creates a second source of truth;
- is justified only by popularity;
- has no production requirement, benchmark, incident, or SLO showing the current approach is inadequate.

## Current stack map

| Area                 | Current repository position                                                             | Audit decision                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Main web application | Angular 22 standalone components, signals, SSR/hydration, service worker                | Keep and harden. No React/Vue rewrite.                                                                                |
| Component behaviour  | Spartan Brain with repository checks                                                    | Keep and complete adoption through existing issues.                                                                   |
| Product presentation | Relay-owned shells, tokens, themes, density, typography, visual contracts               | Keep. This is intentional product ownership, not accidental home-grown behaviour.                                     |
| Styling              | Tailwind CSS 4 plus Relay design tokens                                                 | Keep, while enforcing semantic tokens and logical properties.                                                         |
| Admin portal         | Separate Angular 22 application                                                         | Keep separate for privilege isolation; share generated contracts and approved primitives, not runtime authority.      |
| Backend              | NestJS 11                                                                               | Keep. Consolidate contracts and infrastructure behind modules/adapters.                                               |
| Database/auth        | Supabase PostgreSQL, PostGIS, RLS, Auth                                                 | Keep and make authoritative. Remove competing migration/type authorities.                                             |
| ORM/migrations       | Supabase SQL plus TypeORM dependency/history                                            | Converge under #7449. Do not replace wholesale with Prisma or Drizzle.                                                |
| Realtime messaging   | Centrifugo plus Redis                                                                   | Keep. Do not replace with Socket.IO without an unmet protocol requirement and benchmark.                              |
| Audio/video          | LiveKit                                                                                 | Keep. It is an SFU/media concern, not a generic websocket concern.                                                    |
| Object storage       | Cloudflare R2 through the S3 SDK                                                        | Keep behind a storage adapter and contract tests.                                                                     |
| Background work      | Nest schedule/event emitter; README also names BullMQ                                   | Reconcile implementation and documentation. Use a durable Redis queue for durable work through existing queue issues. |
| API documentation    | Nest Swagger/OpenAPI support                                                            | Promote to an authoritative versioned contract.                                                                       |
| Client transport     | Hand-written Angular HTTP services                                                      | Replace incrementally with generated SDKs behind domain facades.                                                      |
| Logs/metrics         | Pino, `prom-client`, StatsD/Datadog tooling, Prometheus/Grafana compose services        | Keep. Add OpenTelemetry context/tracing incrementally rather than replacing all telemetry.                            |
| Testing              | Vitest, Cypress, deterministic visual capture and many repository-specific static gates | Keep. Consolidate fixtures/contracts; do not force one universal test tool.                                           |
| Package management   | Four npm roots and lockfiles; root scripts use directory changes                        | Converge to npm workspaces, then trial Nx.                                                                            |
| Agent automation     | Typed, phase-specific, multi-provider OpenHands Factory                                 | Keep. The provider-neutral architecture is already present.                                                           |

## Technology radar

### Adopt now

| Technology or pattern                                      | Purpose                                                                                | Why now                                                                                           | Work item                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| npm workspaces                                             | One package graph, deterministic root install, workspace-scoped scripts                | Current manifests and lockfiles drift and root orchestration relies on repeated directory changes | #7441                      |
| Supabase CLI migration authority                           | One deployable schema history including RLS, functions, grants, extensions and indexes | The repository currently has competing schema/migration paths                                     | #7449                      |
| Generated Supabase database types                          | Remove hand-written row/RPC drift                                                      | Database schema is already the natural source of truth                                            | #7449 and CI roadmap #5365 |
| Deterministic OpenAPI export                               | Authoritative REST contract                                                            | Nest Swagger exists, but contract governance and client drift remain fragmented                   | #7443                      |
| Generated Angular SDK                                      | Shared transport DTOs and endpoint methods                                             | Main and admin applications duplicate HTTP contracts                                              | #7447, #3876               |
| `provideAppInitializer()` and modern Angular motion APIs   | Remove upgrade blockers                                                                | Existing providers are deprecated and one is scheduled for Angular 23 removal                     | #7442                      |
| Supabase MFA assurance levels and server-verified passkeys | One authentication assurance authority                                                 | Current custom TOTP/WebAuthn ownership creates security and policy fragmentation                  | #7446                      |

### Trial with a fixed exit decision

| Technology or pattern                | Trial                                                                                                       | Decision gate                                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nx task graph and local cache        | Add incrementally after npm workspace convergence                                                           | Keep only when affected selection is correct and measured CI/local savings exceed configuration and cache-risk costs. Remote caching requires a separate trust review. |
| Storybook Angular Vite               | 8 to 12 representative Relay/Spartan components                                                             | Keep only when it improves component discovery, interaction testing and accessibility without duplicating the existing visual-state source of truth.                   |
| OpenTelemetry for NestJS             | Trace context across HTTP, Redis, Supabase calls, queues, Centrifugo publication, storage and external APIs | Keep when traces explain real incidents/SLO failures and cardinality/cost remain controlled. Browser instrumentation remains a separate later decision.                |
| OpenFeature-compatible server API    | Provider-neutral feature flag evaluation around the server-authoritative flag service                       | Keep when it simplifies application code without moving authorization or sensitive targeting decisions into clients.                                                   |
| Kysely or a narrow typed SQL adapter | Transaction-heavy server paths only, after #7449                                                            | Introduce only where generated Supabase types/query builder cannot express required atomicity and measured maintainability improves. It must not own migrations.       |

### Assess only when a product requirement appears

| Candidate                                  | Trigger required before evaluation                                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capacitor                                  | A committed iOS/Android distribution requirement, native plugin requirements, notification/deep-link/background constraints, and an app-store operating model.                |
| Tauri                                      | A committed desktop product requirement and measurements showing a smaller shell materially improves install size, memory, security or updates over the current web/PWA path. |
| Typesense, Meilisearch or OpenSearch       | PostgreSQL search misses documented relevance, latency, multilingual, typo-tolerance or scale SLOs on a representative corpus.                                                |
| Dedicated workflow engine such as Temporal | Business workflows require durable multi-step orchestration, compensation, long sleeps and human intervention beyond BullMQ/job-state patterns.                               |
| ClickHouse or a warehouse                  | Product analytics or audit queries exceed PostgreSQL/retention/cost limits and have a governed event schema.                                                                  |
| Sentry or another hosted error platform    | Existing logs, metrics and tracing cannot meet incident-response needs and data residency, PII, retention and cost are approved.                                              |

### Keep or reject broad replacement

- Keep Angular. A React, Vue or Svelte rewrite would duplicate solved routing, SSR, DI, forms, signals, testing and component work while delaying product delivery.
- Keep the Relay/Spartan split. Spartan should own reusable accessible behaviour; Relay should own the product visual language, tokens, variants and composition.
- Keep NestJS. Replacing it with Express/Fastify-only code, another Node framework, or a different language has no repository-supported benefit today.
- Keep Supabase/PostgreSQL/PostGIS. Do not move to MongoDB or another database because the product relies on relational integrity, RLS, geospatial querying, search extensions and SQL transactions.
- Do not replace TypeORM with Prisma or Drizzle across the codebase. First remove the duplicate migration authority under #7449. Add a narrow typed SQL tool only where a concrete transaction/query need remains.
- Keep Centrifugo for realtime messaging and LiveKit for media. Socket.IO is not a combined replacement for those responsibilities.
- Keep Vitest and Cypress in their current roles. Add tools only for distinct missing layers, not to standardise names.
- Keep the OpenHands Factory as the orchestrator. Do not let Claude, Codex, Gemini or OpenCode independently own scheduling, Git safety, review, CI gating or merging.

## Detailed findings and recommendations

## 1. Angular is already the replacement for unstructured JavaScript

The main frontend and admin portal are Angular 22 applications. The main frontend uses standalone components, signals, lazy routes, SSR/hydration, a service worker, Vitest and Cypress. A migration from generic JavaScript to Angular is therefore already complete at the framework level.

The remaining Angular work is architectural consistency:

- keep route-level lazy loading and feature boundaries;
- prefer signals for local synchronous UI state while retaining RxJS where streams, cancellation or multicasting are genuinely required;
- avoid adding NgRx solely for uniformity. Introduce a global state framework only when multiple domains demonstrate cross-route state, event replay/debugging, cache invalidation or effects that current services/signals cannot manage safely;
- keep browser-only APIs behind platform checks so SSR and hydration remain deterministic;
- enforce bundle budgets and avoid importing large libraries through barrel files;
- complete deprecated bootstrap/animation migration through #7442.

### Decision

No frontend framework rewrite. Invest in Angular 23 readiness, generated transport contracts, component convergence, SSR correctness, and measurable performance.

## 2. Spartan is already present, but should not own the entire visual language

The repository has `@spartan-ng/brain`, the Spartan CLI, health checks, full-tree adoption reports, boundary verification, component-system convergence checks, token ownership checks, RTL checks, forced-colour checks, reduced-motion checks, visual contract matrices, and a large migration backlog.

This is not a choice between Spartan and a completely home-grown UI. The current architecture intentionally separates:

- **Spartan Brain:** accessible interaction semantics, keyboard behaviour, focus management, overlays and reusable behavioural primitives;
- **Relay:** product presentation, semantic colour, typography, spacing, density, radius, motion, variants, composition and themes.

Replacing Relay presentation shells with generic Spartan visual output would reduce product control and would not remove the need for application-specific visual contracts. Conversely, keeping hand-written keyboard/focus/overlay behaviour where Spartan already provides it would duplicate difficult accessibility logic.

### Decision

Continue existing component-by-component convergence. For each surface:

1. inventory interactions and states;
2. map behaviour to Spartan or approved Angular CDK capabilities;
3. keep presentation in Relay tokens/components;
4. verify keyboard, screen reader, touch, RTL, 200/400 percent zoom, forced colours and reduced motion;
5. update deterministic design previews and route-level visual coverage;
6. remove legacy behaviour only after parity tests pass.

No additional generic “replace UI with Spartan” issue is needed because the backlog already contains the program and component-level work.

## 3. Angular deprecations are a real upgrade blocker

`frontend/src/app/app.config.ts` still uses `APP_INITIALIZER` and `provideAnimations()` at the audited snapshot. Angular deprecates `APP_INITIALIZER` in favour of `provideAppInitializer()`. Angular also deprecates `provideAnimations()` and states an intent to remove it in Angular 23.

The runtime configuration loader and deep-link/protocol setup are bootstrap-sensitive, so this is not a mechanical search-and-replace. The migration must retain asynchronous bootstrap blocking, SSR guards, hydration behaviour, protocol failure handling, reduced-motion behaviour and test semantics.

### Decision

Implement #7442 before an Angular 23 upgrade. Do not add a third-party animation framework by default. Prefer CSS transitions/keyframes and modern Angular enter/leave motion where suitable.

## 4. Package management has higher leverage than another framework

The root, frontend, backend and admin portal are separate npm installations. The root manifest does not declare workspaces, and root scripts repeatedly change directories to coordinate tasks. At the audited snapshot, manifest/lockfile root metadata and dependency snapshots were not consistently aligned.

This increases:

- clean-clone and CI drift risk;
- duplicate dependency download/storage;
- version skew across Angular, TypeScript, ESLint, Vitest and Supabase packages;
- Dependabot and SBOM complexity;
- difficulty sharing generated database/API contracts;
- inability to reason accurately about affected projects.

### Recommended sequence

1. Regenerate and verify every existing lockfile from its manifest.
2. Establish one supported active-LTS Node/npm policy across local development, CI, Docker and VPS documentation.
3. Add npm workspaces and converge to one root lockfile unless a measured deployment constraint requires an exception.
4. Convert root scripts to workspace-aware commands.
5. Move generated contracts into owned workspace packages.
6. Only then add Nx incrementally for task graph, affected selection and local caching.
7. Keep shared/remote caching disabled until credentials, tenancy, cache poisoning, retention and trust boundaries are reviewed.

### Decision

Adopt npm workspaces through #7441. Treat Nx as a benchmarked task-runner/cache trial, not as permission to restructure every directory or generator.

## 5. OpenAPI should become the REST source of truth

The backend already includes Nest Swagger/OpenAPI support, while the Angular applications maintain hand-written HTTP wrappers and DTOs. The backlog repeatedly asks individual domains to add typed client coverage. Solving this independently per domain would create multiple generators, error models and auth policies.

### Target architecture

```text
Nest controllers and DTOs
        |
        v
deterministic OpenAPI artifact
        |
        +--> compatibility/lint/drift gates
        |
        v
pinned Angular client generator
        |
        v
shared generated workspace package
        |
        +--> main frontend domain facades
        +--> admin portal domain facades
```

Generated code should own transport shapes, endpoint methods and serialization. Hand-written facades should own application policy, state, caching, composition and UI-friendly transformations.

The public frontend must not gain privileged admin operations merely because the schema is shared. Public, admin and internal exposure must be explicit and tested.

### Decision

- #7443 owns deterministic export, operation IDs, schema quality, linting, compatibility and publication.
- #7447 owns generator selection/configuration, the shared Angular SDK and incremental client migration.
- #3876 consumes that shared path for the admin portal.
- LiveKit media and Centrifugo realtime protocols remain outside REST/OpenAPI.

## 6. The database needs one authority, not another ORM rewrite

The repository has Supabase migrations/RLS and a TypeORM dependency/history, while many runtime services use Supabase directly. This creates risk around migration order, local reset, remote drift, generated types, RLS validation and production deployment ownership.

The correct first move is not “replace TypeORM with Prisma” or “replace TypeORM with Drizzle”. That would risk creating a third abstraction before removing the duplicate authority.

### Target architecture

- Supabase CLI-managed SQL is the deployable migration authority.
- RLS, grants, functions, triggers, indexes, extensions and storage policies live under the same authority.
- CI recreates a clean local database from source and detects remote/schema drift.
- TypeScript database types are generated from the schema and shared.
- Runtime data access uses typed Supabase clients for normal operations.
- Transaction-heavy domain operations use database functions/RPCs or a narrow typed server SQL layer where required.
- TypeORM is removed when inventory proves it has no required runtime role; otherwise its remaining role is narrowly documented and it does not own migrations.

### Decision

Execute #7449. Consider Kysely or a small `postgres` adapter only for concrete transaction/query gaps after schema ownership has converged. Do not introduce Prisma/Drizzle migrations or rewrite working SQL merely to standardise syntax.

## 7. Durable background work needs implementation/documentation convergence

The README identifies BullMQ, but the audited backend manifest does not directly declare `bullmq` or `@nestjs/bullmq`. The backend does declare Nest schedule, event emitter and Redis support. This is either documentation drift, incomplete queue adoption, or an indirect implementation that needs to be made explicit.

Use in-process events only for work that may be lost on process termination. Use cron only as a scheduler trigger, not as durable state. Work involving retries, rate limits, delayed execution, external APIs, media processing, notifications, exports, recommendations, moderation batches or financial reconciliation should be durable, idempotent and operator-visible.

### Decision

Do not create another generic queue ticket. Coordinate existing work, including:

- [#3503](https://github.com/elgansayer/elgl/issues/3503) for exhausted-job/dead-letter recovery;
- [#3620](https://github.com/elgansayer/elgl/issues/3620) for administrative queue/job controls;
- domain background-job issues already in the backlog.

During implementation:

- choose BullMQ where Redis-backed durable jobs fit the existing stack;
- define idempotency, retry exhaustion, dead-lettering, retention and replay per job class;
- separate scheduler ownership from worker execution;
- expose sanitized queue health and tracing;
- correct README and deployment documentation so package/runtime reality matches the architecture claim.

A workflow engine such as Temporal should be assessed only if the product develops long-running multi-step workflows with compensation, human approval and durable sleeps that become awkward in a queue/state-machine design.

## 8. Centrifugo and LiveKit should remain separate

Centrifugo provides scalable realtime application messaging, presence and channel publication. LiveKit provides WebRTC SFU/media rooms and participant permissions. They are different protocols and failure domains.

Replacing both with Socket.IO would move media, signalling, fan-out, presence and delivery semantics into more application-owned infrastructure. Replacing Centrifugo with Supabase Realtime would also require a measured comparison of channel semantics, delivery guarantees, presence, fan-out, multi-region operation and cost.

### Decision

Keep Centrifugo for realtime messaging and LiveKit for media. Improve typed event envelopes, schema/version compatibility, authorization, reconnect/resume behaviour, backpressure, observability and integration tests. Reconsider only when production metrics show a concrete unmet requirement.

## 9. Authentication needs one assurance authority

The project already uses Supabase Auth, while the audited architecture also contains custom TOTP/WebAuthn behaviour and Firebase dependencies. Multiple identity/assurance authorities make it difficult for backend guards, JWT claims, RLS and clients to agree on whether a session is strongly authenticated.

### Decision

Execute #7446:

- use Supabase MFA factor lifecycle and authenticator assurance levels;
- enforce `aal2` server-side and in relevant RLS policies;
- use server-issued and server-verified passkey/WebAuthn challenges;
- remove duplicate application-owned TOTP secrets after a reversible migration;
- distinguish a local privacy screen from server authentication;
- keep Firebase only for capabilities that remain explicitly required, such as a chosen push-notification channel, behind a narrow adapter.

Do not treat frontend visibility, route guards or client feature flags as authorization.

## 10. Add OpenTelemetry as context, not as a telemetry rewrite

The backend already has structured Pino logging, Prometheus-compatible metrics and StatsD/Datadog-related tooling. The missing cross-cutting capability is likely consistent trace context across HTTP requests, Supabase/Redis operations, queue jobs, Centrifugo publication, storage and external APIs.

OpenTelemetry can provide vendor-neutral trace IDs, spans, propagation and semantic conventions while preserving current logs/metrics/exporters. It should be introduced carefully because automatic instrumentation, high-cardinality attributes and broad browser telemetry can create cost, privacy and performance problems.

### Decision

Align a NestJS OpenTelemetry trial with the existing distributed-tracing and SLO backlog rather than creating a parallel observability program. Start with a few critical flows:

- sign-in and session verification;
- message send/persist/publish;
- media upload and processing;
- subscription/payment webhook handling;
- moderation action;
- one durable background job.

Propagate one correlation identifier through logs, traces, queue metadata and API error envelopes. Redact content, tokens and personal data. Record sampling, retention and attribute-cardinality policy.

Hold browser-wide OpenTelemetry until the server trial proves value and browser support/privacy/overhead are separately assessed. Keep existing metrics and logs unless a measured migration benefit exists.

## 11. Use OpenFeature as an application API, not a security boundary

The backlog already contains a server-authoritative feature flag service, including [#3619](https://github.com/elgansayer/elgl/issues/3619) and its admin/API/testing follow-ups.

An OpenFeature-compatible evaluation API could prevent product code from depending directly on a specific flag provider and make test providers straightforward. It does not remove the need for a server-owned model, audit history, targeting policy, expiry, rollback and authorization.

### Decision

During #3619 implementation, trial an OpenFeature server SDK/provider boundary. Keep sensitive targeting and privileged flags server-side. Clients may receive evaluated, non-sensitive results, but a disabled client control must never be treated as access control.

## 12. Keep PostgreSQL search until evidence supports a search service

The product already depends on PostgreSQL, `pg_trgm`, PostGIS and relational filters. For user discovery, message search, profiles, communities and content, this can cover substantial scale when schemas, indexes, ranking and pagination are designed well.

A dedicated engine adds indexing pipelines, consistency lag, deletion/privacy propagation, multi-tenant authorization, backup/restore, monitoring and cost.

### Decision

Before assessing Typesense, Meilisearch or OpenSearch:

1. define representative multilingual corpora and query mixes;
2. measure p50/p95/p99 latency, relevance and resource use;
3. identify missing capabilities such as typo tolerance, language analysis, faceting or very high query volume;
4. prove PostgreSQL tuning/extensions cannot meet the SLO economically;
5. design deletion, blocking, privacy and authorization propagation.

Only then run a shadow-index proof of concept. PostgreSQL remains authoritative; a search engine would be a derived index.

## 13. Mobile and desktop wrappers need product triggers

The Angular/PWA code can potentially be wrapped for native distribution, but adding a wrapper introduces signing, app-store review, native plugin maintenance, update policy, crash reporting and security work.

### Capacitor

Capacitor is the natural first assessment for an existing web application when the product commits to iOS/Android distribution and needs push notifications, deep links, camera/media, filesystem, share sheet, background operation or biometric APIs. A proof of concept must test SSR/PWA assumptions, LiveKit, microphone/camera permissions, notification delivery, deep links, offline storage, accessibility and app-store policy.

### Tauri

Tauri is an assessment candidate only for a committed desktop product. Compare it against the existing web/PWA route using signed install size, cold start, idle memory, update safety, WebRTC/media behaviour, native integration, accessibility, support burden and security review. Do not create a desktop rewrite merely because a smaller shell is possible.

### Decision

No platform-wrapper issue is created by this audit because the repository does not yet provide a sufficiently specific product requirement or benchmark. Reopen the assessment when distribution and native capabilities are committed.

## 14. Keep the current testing layers and improve contract ownership

The repository already uses:

- Vitest for Angular and backend unit/integration tests;
- Cypress for browser E2E and deterministic visual capture;
- repository-specific static checks for component boundaries, design tokens, RTL, focus, motion, translations and visual contracts;
- a CI hardening roadmap in #5365.

Replacing Cypress with Playwright or replacing Vitest with another runner would only be justified by concrete unsupported scenarios, flake data or runtime measurements.

### Decision

Prioritise missing confidence rather than tool churn:

- database reset/migration/RLS tests;
- OpenAPI compatibility and generated-client drift tests;
- durable queue retry/replay/idempotency tests;
- auth assurance negative-path tests;
- realtime reconnect/resume/authorization tests;
- LiveKit permission and failure tests;
- production-like built-asset E2E;
- accessibility at critical workflows;
- performance budgets tied to user journeys.

Run the Storybook pilot in #7444 only as a component workshop/interaction test assessment. Keep integrated route visual coverage authoritative unless the pilot proves a better ownership model.

## 15. Dependency governance needs targeted remediation

The audited backend manifest includes several packages that deserve explicit ownership and risk controls:

- `node-nlp` is a production alpha dependency. Pin and isolate it behind an NLP adapter, add representative multilingual regression tests, and define a replacement/upgrade path before expanding its responsibility.
- `xlsx` is installed from a SheetJS-hosted tarball rather than the npm registry. Record provenance, integrity, licence, vulnerability and SBOM handling; isolate spreadsheet parsing from request threads and apply strict file/size/resource limits.
- `ngrok` is a beta development dependency. Keep it out of production images and CI unless a controlled test needs it.
- Firebase and Supabase clients exist in multiple applications. Document which platform owns auth, data, push notifications and other capabilities so SDK presence does not become overlapping authority.
- Angular/TypeScript/ESLint/Vitest/Supabase versions should converge through the workspace policy where compatibility permits.

Use #7441 and the supply-chain stages in #5365 to enforce:

- deterministic lockfiles and clean `npm ci`;
- dependency-owner boundaries;
- automated vulnerability and licence reporting;
- SBOM and container scanning;
- pinned GitHub Actions and least-privilege workflow permissions;
- explicit approval for non-registry tarballs, git dependencies and prerelease production packages;
- removal of dependencies that have no imports/runtime role.

## 16. The OpenHands Factory should remain the orchestrator

The repository now documents and implements a typed phase-specific agent router with subscription-backed Claude Code, Codex, configurable Google/OpenCode providers and an optional OpenHands emergency fallback. The Factory retains scheduling, worktrees, state, retries, verification, independent review, CI repair, PR safety and merge policy.

### Decision

Do not replace the Factory with a single coding CLI or revive the retired swarm architecture. Future provider work should add one adapter, configuration and tests without changing pipeline ownership. Continue hardening provider health, durable state, concurrency, secret isolation, provenance, independent review and daemon recovery through the existing Factory documentation and backlog.

## 17. Documentation and implementation must agree

Several architecture claims are now richer than their manifest-level implementation. The clearest audited example is BullMQ: the README names it, while the backend manifest does not directly declare BullMQ packages. The technology stack also evolves quickly through automated PRs and issue-driven work.

### Decision

- Treat this document as a dated decision snapshot, not an evergreen claim of completion.
- Add architecture decision records for adopted/rejected trials.
- Link implementation issues and merged PRs from each decision.
- Add automated documentation checks where a claim can be derived from manifests/configuration.
- Update this audit after major framework, database-authority, client-generation, queue or platform changes.
- Keep the route/information-architecture audit separate from this system technology audit.

## Prioritised execution roadmap

## P0 - security and sources of truth

1. **#7446:** replace custom TOTP/client-only WebAuthn with Supabase assurance levels and server verification.
2. **#7449:** establish one Supabase schema/migration authority and generated database types.
3. Reconcile any production migration or authentication drift before deleting legacy mechanisms.

## P1 - deterministic build and contracts

1. **#7441:** repair lockfiles, adopt npm workspaces, standardise Node/npm policy.
2. **#7442:** remove deprecated Angular initializer/animation providers.
3. **#7443:** produce, lint, diff and version the authoritative OpenAPI artifact.
4. **#7447 and #3876:** generate one shared Angular SDK and migrate domains incrementally.
5. Complete the relevant deterministic dependency, schema and contract gates in **#5365**.

## P2 - durable operations and observability

1. Reconcile BullMQ documentation/implementation and execute the existing durable queue/dead-letter/admin work.
2. Trial server OpenTelemetry on critical flows and align it with existing tracing/SLO issues.
3. Implement the server-authoritative feature flag service and trial an OpenFeature adapter.
4. Continue Relay/Spartan component convergence and accessibility verification.

## P3 - measured developer-experience trials

1. Benchmark Nx after workspace convergence; adopt or remove the pilot.
2. Execute Storybook pilot #7444 and record an adopt/decline ADR.
3. Reassess search, mobile, desktop, workflow-engine and analytics candidates only when their product/scale triggers are met.

## Issue map

### Created or refined by this audit

- [#7441 - Build: converge npm package management, repair lockfile drift, and benchmark Nx](https://github.com/elgansayer/elgl/issues/7441)
- [#7442 - Frontend: replace deprecated APP_INITIALIZER and Angular animation providers before v23](https://github.com/elgansayer/elgl/issues/7442)
- [#7443 - API governance: version, lint and diff the Nest OpenAPI contract](https://github.com/elgansayer/elgl/issues/7443)
- [#7444 - Frontend: pilot Storybook Angular Vite against the existing Relay/Spartan visual contract](https://github.com/elgansayer/elgl/issues/7444)

### Existing high-priority work incorporated into the recommendation

- [#7446 - Supabase MFA assurance levels and server-verified passkeys](https://github.com/elgansayer/elgl/issues/7446)
- [#7447 - Shared generated Angular SDKs from Nest OpenAPI](https://github.com/elgansayer/elgl/issues/7447)
- [#7449 - Authoritative Supabase migrations/types and TypeORM-path retirement](https://github.com/elgansayer/elgl/issues/7449)
- [#3876 - Dedicated typed admin API client](https://github.com/elgansayer/elgl/issues/3876)
- [#3619 - Server-authoritative feature flag API](https://github.com/elgansayer/elgl/issues/3619)
- [#3503 - Dead-letter recovery path](https://github.com/elgansayer/elgl/issues/3503)
- [#3620 - Administrative queue/job controls](https://github.com/elgansayer/elgl/issues/3620)
- [#5365 - CI/testing hardening roadmap](https://github.com/elgansayer/elgl/issues/5365)

## Decision gates for future technology proposals

Every future replacement proposal should answer these questions in its issue or ADR:

1. What concrete production, security, accessibility, reliability, cost or developer-experience problem exists?
2. What repository evidence or measurement establishes the baseline?
3. Why can the current stack not solve it with a smaller change?
4. Which existing dependency or code path will be removed?
5. Who owns the new source of truth?
6. How are data migration, mixed-version rollout and rollback handled?
7. How are secrets, PII, authorization and tenancy protected?
8. What are the test, observability and performance acceptance criteria?
9. What is the ongoing upgrade/licence/vendor cost?
10. What is the fixed date or metric for adopt, revise or remove?

## Official references

- Angular application initializers: <https://angular.dev/api/core/provideAppInitializer>
- Angular animation migration guidance: <https://angular.dev/guide/animations>
- Spartan: <https://www.spartan.ng/>
- npm workspaces: <https://docs.npmjs.com/cli/v11/using-npm/workspaces/>
- Nx incremental adoption: <https://nx.dev/docs/getting-started/start-with-existing-project>
- NestJS OpenAPI: <https://docs.nestjs.com/openapi/introduction>
- OpenAPI specification: <https://spec.openapis.org/oas/latest.html>
- OpenAPI Generator TypeScript Angular: <https://openapi-generator.tech/docs/generators/typescript-angular/>
- Supabase local development and migrations: <https://supabase.com/docs/guides/local-development>
- Supabase generated TypeScript types: <https://supabase.com/docs/guides/api/rest/generating-types>
- NestJS queues: <https://docs.nestjs.com/techniques/queues>
- Centrifugo: <https://centrifugal.dev/docs/getting-started/introduction>
- LiveKit: <https://docs.livekit.io/>
- OpenTelemetry JavaScript: <https://opentelemetry.io/docs/languages/js/>
- OpenFeature: <https://openfeature.dev/docs/reference/intro/>
- Storybook Angular Vite: <https://storybook.js.org/docs/get-started/frameworks/angular-vite>
- Capacitor: <https://capacitorjs.com/docs>
- Tauri: <https://v2.tauri.app/>

## Re-audit trigger

Repeat this audit after the first of these events:

- npm workspace/Nx decision merges;
- Supabase/TypeORM migration authority converges;
- generated OpenAPI SDK reaches both Angular applications;
- Angular 23 upgrade begins;
- durable queue implementation is reconciled;
- a native mobile or desktop product is approved;
- six months have elapsed.
