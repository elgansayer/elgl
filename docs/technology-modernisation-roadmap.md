# Technology modernisation roadmap

**Programme tracker:** #7458  
**Deep-dive evidence and decisions:** [`technology-modernisation-audit-2026-08.md`](./technology-modernisation-audit-2026-08.md)

## Objective

Replace duplicated, security-sensitive or process-local infrastructure with maintained platforms while preserving the repository's working product architecture:

```text
Angular web + Angular admin
NestJS modular backend
Supabase Auth/Postgres/RLS/Storage
Centrifugo realtime
LiveKit media
Relay tokens + Spartan primitives
OpenHands Factory orchestration
```

This roadmap is intentionally incremental. “Wholesale migrations are allowed” means a subsystem may be replaced completely when the evidence supports it. It does not mean unrelated subsystems should be rewritten together.

## Programme rules

1. **Security P0 work wins conflicts.** Authentication, MFA, RLS and migration authority take precedence over convenience refactors.
2. **One platform per concern.** Do not introduce a second queue, schema history, offline database wrapper, generated API client or primitive library.
3. **Reference implementation first.** Prove one domain end to end before broad codemods.
4. **Compatibility before deletion.** Dual-read, shadow, adapters or re-exports remain until parity and rollback are demonstrated.
5. **Generated artifacts are deterministic.** OpenAPI clients and Supabase database types must regenerate cleanly in CI.
6. **Product rules remain repository-owned.** Libraries own protocol/infrastructure mechanics, not language-learning, community, moderation or economy policy.
7. **No silent safety regression.** RLS, backend authorization, reviewed-SHA protection, accessibility and OpenHands verification remain authoritative.
8. **No placeholder privileged production behaviour.** Test mocks belong in MSW/test providers, never in runtime auth services.

## Dependency graph

```text
                              #7445 runtime mock auth removal
                                        |
                                        v
                              #7446 Supabase MFA/AAL

#7452 npm workspaces + Nx ----+----> #7447 generated Angular API SDK
          |                   |
          |                   +----> #7449 shared generated DB types
          |
          +------------------------> #7453 shared Relay/Spartan UI
                                           |
                                           v
                                      #7454 Storybook/browser/a11y

#7449 Supabase schema authority ----> #7451 immutable review log + FSRS
                    |                         ^
                    |                         |
                    +----> typed contracts    |
                                              |
#7450 Dexie/offline outbox -------------------+
          |
          +------------------------> #7456 Angular resources/SignalStore

#7448 BullMQ job platform ----------> #3503 dead-letter path
          |
          +------------------------> #7455 OTel job trace propagation

#7453/#7454 overlay tests ----------> #7457 native CSS animation migration

#5365 testing/CI roadmap coordinates generated types, migration tests,
Cypress/Playwright overlap, accessibility, visual regression and full CI gates.
```

## Wave 0: security and authority

### Gate 0A: production authentication fails closed

**Issue:** #7445

Deliver before relying on frontend authentication tests for later work.

Required outcome:

- no fabricated runtime user/session;
- no mock bearer token in production code/bundles;
- route guards and API interceptors handle a real unauthenticated state;
- deterministic tests use MSW or explicit providers.

Suggested PR split:

1. fail-closed regression tests and `AuthState` model;
2. remove runtime fallback and repair guards/interceptors;
3. add MSW fixtures and production-bundle enforcement;
4. migrate Storybook/browser fixtures later without reopening production paths.

### Gate 0B: one authentication-assurance authority

**Issue:** #7446

Required outcome:

- Supabase factor enrollment/challenge/verification;
- `aal2` enforced by Nest guards and relevant RLS policies;
- bounded migration from legacy secrets;
- passkeys feature-flagged and server verified;
- recovery and lost-device policy.

Do not drop legacy columns until the migration window and account-recovery procedure have been exercised.

### Gate 0C: establish schema ownership

**Issue:** #7449

Begin with inventory before any destructive consolidation.

Required evidence:

- mapping of every TypeORM/backend migration to the Supabase history;
- clean `supabase db reset` from source control;
- remote/local drift report;
- generated database-type command;
- explicit TypeORM runtime-use inventory.

### Gate 0D: make the HTTP contract deterministic

**Issue:** #7447

Begin contract linting and operation-ID cleanup while schema work proceeds.

Do not generate a client over an unstable or incomplete OpenAPI document and then treat generated mistakes as correctness.

## Wave 1: shared platform foundations

### Workspaces and project graph

**Issue:** #7452

Land npm workspaces first, then Nx metadata. Keep existing commands working.

Recommended early target names:

```text
web:build, web:test, web:lint
admin:build, admin:test, admin:lint
api:build, api:test, api:lint
e2e:test
factory:test
```

Recommended first shared libraries:

```text
api-contract
api-client
database-types
design-tokens
ui
test-fixtures
```

Do not move source directories until project graph, imports and affected CI are stable.

### Generated API client

**Issue:** #7447

Reference migration order:

1. admin health/read-only endpoint;
2. admin paginated collection;
3. admin mutation with validation/error envelope;
4. main frontend read domain;
5. upload/download endpoint;
6. remaining domains behind compatibility facades.

Success is not measured by generated file count. It is measured by deleted duplicate URLs/DTOs and contract drift caught before merge.

### Supabase schema and generated types

**Issue:** #7449

Reference migration order:

1. type the shared `SupabaseClient<Database>`;
2. migrate a read-only repository;
3. migrate an RPC/transaction-heavy path;
4. reconcile backend migration history;
5. disable old migration execution;
6. remove TypeORM only after runtime proof.

### BullMQ durable jobs

**Issue:** #7448

Reference migration: `EscrowQueueWorker`.

Why first:

- existing `setInterval` polling is visible;
- process-local locks demonstrate the multi-replica problem;
- idempotency and stale-processing behaviour already matter;
- queue metrics and graceful shutdown can be tested concretely.

Second reference: one privacy/account scheduled job.

After the substrate is stable, implement #3503 rather than creating a parallel dead-letter mechanism.

### Dexie offline platform

**Issue:** #7450

Reference migration: SRS offline cache and review outbox.

Required before economy/escrow offline migration:

- per-user partitioning;
- durable acknowledgement/idempotency contract;
- cross-tab lease behaviour;
- crash-mid-sync tests;
- quota and private-mode handling;
- explicit conflict policy.

Admin/moderation data remains denied offline unless separately approved.

### OpenTelemetry foundation

**Issue:** #7455

Land in this order:

1. resource attributes and redaction/cardinality contract;
2. Node SDK loaded before Nest;
3. HTTP and Pino correlation;
4. Supabase/Redis manual spans;
5. BullMQ trace propagation;
6. dashboard/alert parity;
7. removal of duplicate emitters where justified.

Telemetry export must fail open with bounded buffers/timeouts.

## Wave 2: domain and interface convergence

### Shared Relay/Spartan UI

**Issue:** #7453

Reference migration order:

1. correct the Helm inventory and run Spartan healthcheck;
2. expose tokens and primitives through stable public entry points;
3. migrate one admin form/dialog/table workflow;
4. migrate shared feedback and navigation patterns;
5. migrate remaining primitive categories;
6. remove obsolete compatibility wrappers only after consumers move.

Keep the admin application independently deployable.

### Executable component catalogue

**Issue:** #7454

Go/no-go pilot components:

- button;
- form field;
- dialog;
- data table;
- multilingual composite pattern.

The pilot must prove production build, providers, MSW, Tailwind/Relay tokens, aliases, SVG/icons, focus/overlay behaviour and CI stability.

If Angular Vite preview integration fails the decision gate, retain portable stories/fixtures and use Playwright until a supported builder is available.

### Angular state architecture

**Issue:** #7456

Reference domain: vocabulary/SRS after generated API and Dexie boundaries exist.

The migration should separate:

```text
transport contract -> generated client
offline persistence -> Dexie repository
server query state -> resource/data-access facade
shared domain state -> SignalStore
streaming updates -> RxJS/realtime adapter
presentation -> components and Relay tokens
```

Do not create a global store for local or request-derived state.

### FSRS scheduler

**Issue:** #7451

The cutover sequence is:

1. immutable review-event model;
2. legacy golden tests;
3. versioned `SrsScheduler` adapter;
4. FSRS shadow computation;
5. aggregate comparison and invariants;
6. new-card/small-cohort rollout;
7. explicit existing-card migration;
8. old scheduler removal only after rollback window.

Store original offline review timestamps and stable operation IDs. Server receive time is not an acceptable substitute.

### Native Angular motion

**Issue:** #7457

Start after overlay/dialog stories or browser tests exist.

Migration groups:

1. simple CSS state transitions;
2. entry/exit components using `animate.enter`/`animate.leave`;
3. overlays/dialogs with focus restoration;
4. route/composite transitions;
5. remove `provideAnimations()`;
6. remove `@angular/animations` after dependency proof.

## Wave 3: systematic removal

Once reference implementations are proven, create bounded domain PRs that remove the old layer.

Removal candidates include:

- mock user/session constants and mock tokens;
- custom TOTP/passkey code and secret columns;
- handwritten endpoint URLs and duplicate transport DTOs;
- TypeORM migration runner/files/dependencies where unused;
- raw `indexedDB.open` feature implementations;
- process-local polling workers and durable EventEmitter side effects;
- bespoke SM-2 implementation after cohort migration;
- duplicate admin styles/primitives;
- duplicated visual/component catalogue tooling;
- old metrics emitters after dashboard parity;
- deprecated Angular animations provider/package;
- child lockfiles and root dependencies superseded by workspaces.

Deletion PRs must link the migration evidence that makes deletion safe.

## Parallel-work collision map

| Area | Likely conflicting issues | Coordination rule |
|---|---|---|
| Root/package manifests | #7447, #7448, #7450, #7451, #7452, #7454, #7455, #7456 | #7452 establishes workspace shape first or package changes are rebased through one owner |
| Angular bootstrap/providers | #7445, #7454, #7455, #7457 | Keep provider changes in small commits; merge security before catalogue/motion work |
| Auth service/guards | #7445, #7446, #7456 | #7445 fail-closed state first, #7446 assurance next, store refactor last |
| Supabase migrations | #7446, #7449, #7451 | #7449 defines ordering/authority; feature migrations follow expand/migrate/contract |
| SRS frontend/backend | #7450, #7451, #7456 | Dexie/outbox contract first; review log/scheduler second; store presentation last |
| Admin services/UI | #7447, #7453, #7454 | Generated transport and shared UI can proceed on separate files but coordinate one reference screen |
| Workers/telemetry | #7448, #7455, #3503 | Queue contract first, tracing second, DLQ third |
| CI/test configuration | #7452, #7454, #5365 | #5365 retains test-governance ownership; Nx scopes tasks, Storybook adds component target |
| Factory automation | provider-routing work and all issues | Factory safety/prompt/verification changes stay isolated from product migrations |

## PR sizing guidance

A “wholesale migration” may span many PRs. Prefer coherent checkpoints:

- one platform abstraction;
- one reference implementation;
- one observability/operations addition;
- one domain batch;
- one compatibility removal.

Avoid PRs that simultaneously:

- change authentication and database migration ownership;
- introduce Nx and physically move all applications;
- add BullMQ and migrate every cron/event listener;
- add Dexie and convert every offline feature;
- switch every card to FSRS;
- replace all admin and product UI;
- remove every existing test tool.

## Programme metrics

Track progress with outcomes rather than issue counts.

### Security

- production mock identities/tokens: target `0`;
- application-owned TOTP/passkey secrets: target `0` after migration;
- sensitive operations requiring `aal2`: target `100%` of policy inventory;
- RLS/auth negative-path regression coverage: target `100%` of privileged domains.

### Contracts/data

- backend operations represented in OpenAPI: target `100%` of supported HTTP API;
- hand-written transport endpoint strings outside adapters: target `0`;
- deployable migration histories: target `1`;
- generated database-type drift: target `0`.

### Reliability

- process-local durable workers: target `0`;
- durable job types with idempotency/retry/timeout/retention: target `100%`;
- raw IndexedDB implementations outside offline platform: target `0`;
- offline mutations with durable operation IDs: target `100%`.

### UI/accessibility

- shared primitive systems: target `1` across web/admin;
- owned primitives with stories and interaction/a11y coverage: target `100%`;
- primitive behaviour reimplemented in feature components: target `0` without exemption;
- deprecated Angular animations imports/providers: target `0`.

### Developer experience

- supported JavaScript install commands: target `1` root workflow;
- workspace projects represented in Nx graph: target `100%`;
- duplicate lockfiles: remove where workspaces make them obsolete;
- affected PR CI plus full scheduled CI: both required.

### Observability

- HTTP requests correlated to logs: target `100%` where sampled;
- queued work linked to source trace/correlation: target `100%` of migrated job types;
- telemetry attributes containing prohibited sensitive data: target `0`;
- old dashboards without parity mapping: target `0` before emitter removal.

## Rollback standard

Every platform migration needs a written rollback that answers:

1. What feature/config flag stops new use?
2. Can old and new data be read safely by the prior version?
3. How are queued/in-flight operations drained or reconciled?
4. Which generated/schema artifacts must be rolled back together?
5. What metrics show rollback succeeded?
6. What data must never be discarded during rollback?

For security fixes, rollback must not re-enable unsafe behaviour. For example, a failed MSW migration may restore test providers, but it must not restore a fabricated production session.

## Definition of programme completion

The programme is complete when:

- all child issues in #7458 have been implemented or explicitly rejected through an updated decision record;
- #3503 and the relevant #5365 stages are aligned with the shared platforms;
- architecture and component-system documentation describe the implemented state rather than intended state;
- no superseded package or custom subsystem remains in production merely for compatibility without an owner and removal date;
- the full repository verification, Factory tests, schema reset/migration tests, generated-artifact drift checks and browser suites pass on the final converged architecture.
