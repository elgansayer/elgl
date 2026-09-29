# Test isolation, flake handling, and browser E2E ownership

Audit date: 2026-08-24.

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

## Playwright web-server readiness contract

Playwright starts the NestJS and Angular web servers as separate `webServer` entries. Playwright may launch entries in that array concurrently, so the Angular development/SSR server must not assume that NestJS is already accepting connections merely because the backend process has been spawned.

`e2e/backend-readiness.mjs` is the explicit dependency gate. The Angular web-server command runs it before `npm run start`; the gate polls only the backend health endpoint, uses bounded per-request and overall timeouts, backs off between retries, and exits non-zero if the backend never becomes healthy. Expected connection-refusal errors during NestJS startup are intentionally not dumped to QA output because undici can surface them as noisy `AggregateError [ECONNREFUSED]` stacks that hide the real readiness state.

The default E2E backend health endpoint and Angular development `apiUrl` both use the exact IPv4 loopback origin `http://127.0.0.1:3000`. Do not mix `localhost` with `127.0.0.1` at this boundary: Node SSR may resolve `localhost` to `::1` while the readiness gate has only proved the IPv4 listener healthy, recreating the misleading `TypeError: fetch failed` / `ECONNREFUSED` startup failure. `e2e/webserver-readiness-contract.test.mjs` locks the two defaults to the same origin so this drift cannot silently return.

`E2E_BACKEND_HEALTH_URL` can override the health endpoint for an isolated harness; credential-bearing and non-HTTP(S) URLs are rejected. When using an override whose origin differs from `http://127.0.0.1:3000`, the harness must also provide a matching frontend API configuration. Otherwise the readiness probe would be checking a different server than Angular SSR uses. `E2E_BACKEND_READY_TIMEOUT_MS`, `E2E_BACKEND_ATTEMPT_TIMEOUT_MS` and `E2E_BACKEND_READY_INTERVAL_MS` are optional positive-integer tuning controls.

Run the focused contracts with:

```bash
cd e2e
npm run test:readiness
npm run test:webserver-readiness-contract
```

A readiness timeout is an infrastructure/startup failure, not an application assertion failure. Diagnose the NestJS process/configuration first. Do not replace the gate with a fixed sleep or suppress the failure. The change is operational only: it creates no persisted data, changes no authorization boundary, and can be rolled back by restoring the previous Playwright/frontend loopback configuration.

## Current Playwright CI blocker

Playwright is not currently wired into the canonical GitHub Actions workflows. Its config starts the real backend and frontend servers. Backend startup validates configuration for Supabase, database, Redis, Centrifugo, LiveKit, R2, translation services, and Stripe. A nightly Playwright job therefore needs a reproducible test harness/service stack or explicit test doubles before it can be added without becoming permanently red.

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
