# Core product E2E flows

Issue #1401 requires end-to-end coverage for authentication, chat messaging, and Moment creation. The repository already had a basic Playwright baseline from #1051, but several assertions were conditional or timer-driven and could pass without exercising the product mutation. The core suites now use deterministic first-party API boundaries and assert the actual request payloads produced by the Angular UI.

## Authoritative specifications

- `e2e/tests/auth.spec.ts` drives the real forgot-password forms, verifies password-reset request payloads, exercises token-based reset navigation, and keeps onboarding language selection covered.
- `e2e/tests/chat-messaging.spec.ts` loads a deterministic room/history fixture through the public chat APIs, types into the production composer, submits through the grammar-check path, verifies `POST /api/chat/messages`, and confirms the returned message is rendered.
- `e2e/tests/moment-creation.spec.ts` loads the real Moments screen, opens the composer, runs the grammar-check boundary, verifies `POST /api/moments`, confirms the created Moment is rendered, and proves a failed publish leaves the draft available for retry.

These specifications exercise the Angular components and services in a real browser. Only backend/provider boundaries are intercepted; the tests do not replace the UI with test-only components or mutate production data.

## Determinism rules

The three core flows deliberately avoid fixed sleeps and conditional assertions. `scripts/verify-core-e2e-flows.mjs` rejects the core specs if they reintroduce `waitForTimeout`, `isVisible().catch(...)`, skipped/fixme suites, or remove the request/payload assertions that prove the mutations occurred.

Fixtures use synthetic identities, messages, and Moments. API responses are bounded to the minimum data required by the application so a test cannot depend on a developer account, Supabase state, Centrifugo availability, or third-party NLP availability.

## CI contract

`.github/workflows/e2e-core-flows-contract.yml` performs two inexpensive checks on pull requests, merge queues, and protected branch pushes:

1. `node scripts/verify-core-e2e-flows.mjs` verifies that all three Playwright specs remain present, enabled, deterministic, and contain their critical request assertions.
2. `npm test -- --list tests/auth.spec.ts tests/chat-messaging.spec.ts tests/moment-creation.spec.ts`, run from `e2e/`, proves Playwright can compile and discover the flows from the correct package context.

The lightweight contract intentionally does not pretend test discovery is browser execution. Full end-to-end execution remains:

```bash
cd e2e
npm ci --legacy-peer-deps
npm test -- tests/auth.spec.ts tests/chat-messaging.spec.ts tests/moment-creation.spec.ts
```

That command starts the configured NestJS and Angular web servers and executes the flows across the desktop English, RTL Arabic, RTL Hebrew, and mobile Safari projects defined in `e2e/playwright.config.ts`.

## Failure behaviour

The contract fails if a required file disappears, a critical API interaction is removed, a core suite is disabled, or timer/conditional-pass patterns are reintroduced. The browser flows themselves fail if the UI no longer sends the expected request, changes the request payload unexpectedly, fails to render the authoritative response, or loses retryable draft state after a Moment publish failure.

Product changes that intentionally alter routes, payloads, or journeys must update the corresponding E2E specification and this contract in the same pull request. Provider/network failures in tests should be represented by explicit route fixtures rather than hidden retries or sleeps.

## Security and privacy

Core E2E specifications use synthetic content only. They do not commit production credentials, access tokens, private messages, real profile data, or provider secrets. Password values and reset tokens are test-only literals sent exclusively to intercepted first-party endpoints. Chat and Moment fixtures are never persisted outside the isolated browser run.

The tests preserve the same browser-side validation and component/service boundaries as production, including the grammar-check step before chat/Moment submission. Authentication and provider secrets remain in CI secret stores when another full-stack environment genuinely requires them.

## Accessibility and localisation

Selectors prefer semantic elements, stable form IDs, and existing product test IDs instead of translated visible copy, allowing the same flows to run across LTR, RTL, desktop, and mobile Playwright projects. No production accessibility semantics are changed by this test-only implementation.

## Rollout and rollback

This work changes tests, fixtures, and documentation only. There is no schema migration, API change, persisted-data rewrite, or production runtime flag. Rollout is the normal CI adoption of the hardened specs. Rollback is a normal revert; doing so does not alter user data or deployed service behaviour.
