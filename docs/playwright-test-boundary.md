# Playwright test-runner boundary

## Purpose

ELGL has two different JavaScript test-runner families with deliberately separate discovery roots:

- Angular unit/component tests live under `frontend/src/**` and run through Angular/Vitest.
- Browser E2E tests live under `e2e/tests/**` and run through Playwright using `e2e/playwright.config.ts`.

Running `playwright test` from `frontend/` (or from the repository root without an explicit E2E config) lets Playwright fall back to broad default discovery. It can then execute Angular `*.spec.ts` files as Playwright tests. Those files legitimately use Vitest globals such as `describe` and `it`, producing misleading failures such as `ReferenceError: describe is not defined`.

## Enforced contract

`npm run check:playwright-test-boundary` verifies all of the following:

1. `e2e/playwright.config.ts` pins `testDir` to `./tests`.
2. `e2e/package.json` owns both the canonical `playwright test` script and the `@playwright/test` dependency.
3. Tracked scripts/workflows may invoke `playwright test` only when they run from `e2e/` or supply `--config e2e/playwright.config.ts` explicitly.
4. Frontend unit-test files must not import `@playwright/test`.

The check is part of the root `npm run verify` chain, so a future QA loop, workflow, or package-script regression fails before it can misclassify Vitest suites as Playwright tests.

## Safe invocation patterns

Use one of these forms from automation:

```sh
(cd e2e && npx playwright test)
```

or:

```sh
npx playwright test --config e2e/playwright.config.ts
```

GitHub Actions may instead set `working-directory: e2e` for the step running `npx playwright test`.

Do not run bare `npx playwright test` from `frontend/` or the repository root.

## Failure handling and observability

The verifier reports the tracked file and line containing an unsafe invocation. It intentionally does not print environment values, test payloads, browser traces, credentials, or application data.

A failed boundary check is a configuration failure, not a product outage. Correct the invocation/configuration and rerun verification; no database, cache, or user-data recovery is needed.

## Rollout and rollback

This change is CI/developer-tooling only and introduces no runtime API, schema, persistence, authentication, or UI changes. It is safe to deploy independently of application services.

Rollback is code-only: revert the verifier, tests, and package-script wiring. The canonical `e2e/` Playwright layout should remain in place even during rollback because moving Playwright discovery back into the frontend recreates the original test-runner collision.
