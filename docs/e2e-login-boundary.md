# E2E authentication boundary

## Purpose

This contract prevents non-authentication Playwright scenarios from losing their entire test timeout inside a conditional login helper before the scenario under test starts.

The historical failure tracked by #1583 came from `e2e/tests/adversarial/adversarial-chat-video.spec.ts`. Its shared `loginIfNeeded` helper attempted to fill the legacy `input[name="email"]` selector. The generated adversarial suite was later removed because it depended on incorrect selectors and an authentication flow that did not match the application. Raising Playwright's timeout would only have hidden that root cause.

## Contract

Authentication form interaction belongs only in dedicated authentication specs such as `auth.spec.ts` and `auth-flows.spec.ts`.

All other E2E specs must establish the state they require deterministically before exercising their product behavior. Use the repository's existing route fixtures, storage/session setup, API fixtures, or other explicit test preparation appropriate to the scenario. The target page or control should then be asserted as ready before the actual behavior is exercised.

Non-authentication specs must not:

- define or call a generic `loginIfNeeded` helper;
- scrape the legacy `input[name="email"]` login selector;
- conditionally continue when authentication setup is incomplete;
- increase scenario timeouts to compensate for a missing or wrong login surface.

The historical generated adversarial suite should not be restored unchanged. A replacement security/adversarial scenario must use current product selectors and deterministic state setup.

## Failure handling and observability

`npm run check:playwright-test-boundary` performs a read-only repository scan before an expensive Playwright run. It fails with the exact offending file when a conditional login helper or legacy login selector is reintroduced outside authentication tests.

This converts the previous 30-second `page.fill` timeout into an immediate, actionable contract failure and keeps the diagnostic tied to the source file that introduced the regression.

## Security and privacy

E2E credentials must be synthetic test credentials. Tests and helpers must not print passwords, access tokens, refresh tokens, session cookies, or production user data. The boundary verifier inspects source text only and does not execute authentication or read runtime credentials.

## Verification

The contract is covered by `scripts/verify-playwright-test-boundary.test.mjs`, including regression cases for:

- the historical `loginIfNeeded` plus `input[name="email"]` pattern;
- renamed helpers that still use the legacy selector;
- legitimate login-form interaction inside dedicated authentication specs.

The existing Playwright Test Boundary workflow and root `npm run verify` pipeline execute this contract in a clean environment.

## Rollout and rollback

This is a CI/test-governance change only. It does not alter application runtime behavior, APIs, data, authentication policy, or schema and therefore needs no data migration.

Rollback is a code revert of the verifier, its tests, and this document. No production-state recovery is required. If a future authentication-test layout changes, update the explicit authentication-spec allowance and its regression tests rather than weakening the non-authentication boundary.
