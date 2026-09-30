# Core product E2E flows

Issue #1051 requires Playwright coverage for authentication, chat messaging, and Moment creation. Those flows live in the standalone `e2e` package and are intentionally kept separate from frontend Vitest tests.

## Authoritative specifications

- `e2e/tests/auth.spec.ts` covers authentication-adjacent user journeys, including forgot/reset password and onboarding form interaction.
- `e2e/tests/chat-messaging.spec.ts` covers chat-list and room navigation plus message-composer interaction.
- `e2e/tests/moment-creation.spec.ts` covers the Moments feed, opening the composer, entering Moment text, and the creation controls.

The repository also contains broader companion suites, but these three files are the minimum #1051 completion contract.

## CI contract

`.github/workflows/e2e-core-flows-contract.yml` performs two inexpensive checks on pull requests, merge queues, and protected branch pushes:

1. `node scripts/verify-core-e2e-flows.mjs` verifies that all three Playwright specs remain present, enabled, and contain their critical interaction markers.
2. `npm test -- --list tests/auth.spec.ts tests/chat-messaging.spec.ts tests/moment-creation.spec.ts`, run from `e2e/`, proves Playwright can compile and discover the flows from the correct package context.

The contract workflow deliberately does not pretend test discovery is browser execution. Full end-to-end execution remains:

```bash
cd e2e
npm ci --legacy-peer-deps
npm test -- tests/auth.spec.ts tests/chat-messaging.spec.ts tests/moment-creation.spec.ts
```

That command starts the configured NestJS and Angular web servers and executes the flows across the Playwright projects defined in `e2e/playwright.config.ts`.

## Failure behaviour

The contract fails if a required file disappears, a critical interaction is removed, a core suite is disabled with `skip`/`fixme`, or Playwright can no longer discover the specs. This catches accidental runner drift without requiring credentials or browser downloads in the lightweight contract job.

Failures from the full browser run should remain explicit rather than being converted into conditional passes. Product changes that alter selectors or journeys must update the corresponding E2E specification and this contract in the same pull request.

## Security and privacy

Core E2E specifications must use test identities and synthetic content only. Do not commit production credentials, access tokens, private messages, real profile data, or provider secrets. Authentication and application secrets belong in CI secret stores when a browser environment genuinely requires them.

## Rollback

This change adds only verification and documentation. Rollback is a normal revert. Removing the contract does not change production behaviour, persisted data, routes, or API shapes.
