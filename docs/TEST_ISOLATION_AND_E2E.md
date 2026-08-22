# Test isolation, flake handling, and browser E2E ownership

Audit date: 2026-08-15.

## Isolation contract

Tests must be independently repeatable. A test may not depend on execution order, state left by a previous test, wall-clock timing when a controllable clock is available, or mutable process/global state that is not reset after the test.

When a suite uses a database, cache, browser storage, network mock, event bus, or singleton service, its setup/teardown must restore a known state. Randomized fixtures must either use a recorded seed or emit enough information to reproduce the failing case.

Fixed sleeps are a last resort. Prefer observable conditions: DOM state, API completion, websocket state, queue drain, fake timers, or explicit service readiness.

## Flake policy

A flaky test is a product/engineering defect, not a reason to silently weaken CI.

- Do not disable or skip a required test solely because it intermittently fails.
- Do not add broad `continue-on-error` to hide flaky suites.
- Retries are diagnostic only; they must not become a substitute for fixing nondeterminism.
- A quarantined test needs a tracked issue, an owner, and an explicit removal condition.
- Quarantine must remain visible and must not reduce required coverage without review.
- Prefer a separate scheduled repeat-run job to discover flakes rather than retrying a required PR check until it passes.

The standalone Playwright configuration currently uses two retries in CI. Before Playwright becomes a required gate, retry behaviour should be paired with flake reporting or reduced so intermittent failures cannot silently pass.

## Browser E2E inventory

There are currently two browser E2E systems.

### Cypress (`frontend/cypress/e2e`)

Current flows include:

- admin moderation dashboard
- base application smoke test
- chat flow
- discovery map
- escrow/payments
- home
- LingQ-style reading engine
- matchmaking
- trust and safety
- video classrooms
- virtual coin economy

Cypress should remain the owner of feature-heavy frontend flows already implemented there. New tests should not duplicate an existing Cypress flow in Playwright without a specific cross-browser or infrastructure reason.

### Playwright (`e2e/tests`)

Current Playwright coverage includes authentication/onboarding pages, chat/messaging, moments, SRS, matchmaking, virtual-coin economy, RTL mirroring, and LiveKit/Centrifugo flows. Its projects cover English desktop, Arabic RTL, Hebrew RTL, and mobile Safari-style device emulation.

Playwright is the better home for cross-browser, RTL, device-profile, and full-stack/infrastructure-sensitive flows. Cypress remains appropriate for existing Angular-centric feature flows.

## Runner context contract

Test files must be executed by the package and runner that owns them. A Playwright spec imports globals such as `test`, `expect`, and suite helpers from `@playwright/test`; running that file directly through Node, `tsx`, `ts-node`, Bun, Vitest, or Jest bypasses Playwright's runner bootstrap and can surface misleading errors such as `ReferenceError: describe is not defined`.

Use these package-owned entry points:

- Angular/frontend unit tests: `cd frontend && npm test`
- NestJS/backend unit tests: `cd backend && npm test`
- Admin portal unit tests: `cd admin-portal && npm test`
- Standalone Playwright E2E: `cd e2e && npm test`
- Playwright discovery without starting browsers: `cd e2e && npm test -- --list`

Do not execute `e2e/tests/*.spec.ts` directly with a generic JavaScript/TypeScript runtime, and do not pass `e2e/tests` to Vitest or Jest. CI and automation commands that touch the standalone Playwright suite must enter the `e2e` package context first.

`npm run check:test-runner-contexts` is the repository guard for this ownership contract. It validates package-script ownership, rejects known wrong-runner command forms in workflows and automation instructions, and verifies that the lightweight Playwright discovery workflow installs and runs from `working-directory: e2e`.

## Current Playwright CI blocker

Full Playwright browser execution is not currently wired into the canonical GitHub Actions workflows. The lightweight `E2E Runner Context` workflow performs test discovery only, which proves the correct runner can collect the suite without starting application servers or browsers.

The Playwright config starts the real backend and frontend servers. Backend startup validates configuration for Supabase, database, Redis, Centrifugo, LiveKit, R2, translation services, and Stripe. A full or nightly Playwright job therefore needs a reproducible test harness/service stack or explicit test doubles before it can be added without becoming permanently red.

Do not solve this by injecting production credentials into untrusted PR jobs. Build an isolated CI environment first.

## Path to scheduled E2E

1. Define a CI-only backend configuration and service stack/test doubles.
2. Make browser data reset deterministic between tests.
3. Run Playwright with a reproducible seed and no hidden pass-on-retry semantics.
4. Upload Playwright HTML/trace/screenshot artifacts for failures.
5. Start as a scheduled informational run.
6. Measure flake rate and duration.
7. Promote stable critical flows to required checks only after the environment is deterministic.

## Ownership rule

When adding an E2E test, first search both `frontend/cypress/e2e` and `e2e/tests`. Extend the existing owner suite unless the test specifically requires capabilities owned by the other runner. This prevents two large suites from independently asserting the same user flow and drifting apart.
