# Issue 1674: QA Test Failure ReferenceError Investigation

## Overview

This investigation addresses Task 1674:
"Fix QA test failure: `ReferenceError: describe is not defined` in test suites"
(originating from the legacy swarm queue file `00871-473-fix-qa-test-failure-referenceerror-describe-is-not-defined-i.task`).

## Root Cause Analysis and Historical Context

The error `ReferenceError: describe is not defined` previously occurred when:
1. **Wrong Discovery Root**: The legacy QA swarm runner (`qa-loop.sh` or ad-hoc runs) executed `npx playwright test` from `frontend/` or the repository root without specifying `--config e2e/playwright.config.ts`. In the absence of a localized `playwright.config.ts`, Playwright defaulted to a broad test discovery pattern that picked up Angular unit test files (`*.spec.ts`) under `frontend/src/`. Angular unit tests use Vitest runner globals (`describe`, `it`, `beforeEach`), which do not exist within Playwright's execution context, resulting in `ReferenceError: describe is not defined`.
2. **Incorrect Runner API inside E2E Specs**: An E2E test file in `e2e/tests/` called `describe()` as a bare global rather than invoking `test.describe()` from `@playwright/test`.
3. **Improper DevDependency**: `@playwright/test` was formerly included in `frontend/package.json`, which allowed `npx playwright test` to be accidentally launched within the frontend directory.

## Current Repository Verification and Safeguards

A comprehensive audit of the current codebase confirms that the defect has already been resolved and mechanically guarded against regressions:

1. **Dependency Isolation**:
   - `frontend/package.json` does not include `@playwright/test` (removed via PR #3260 / commit `2db477e98`). Playwright dependencies and scripts are isolated exclusively in `e2e/package.json`.
   - Frontend unit tests execute via Vitest with explicit `globals: true` configured in `frontend/vitest.config.ts`.
   - Backend unit tests execute via Vitest with explicit `globals: true` configured in `backend/vitest.config.mts`.
   - Admin portal unit tests execute via Angular's unit-test builder with Vitest runner configured in `admin-portal/angular.json`.

2. **Automated Playwright Test Boundary Verification**:
   - The repository enforces `npm run check:playwright-test-boundary`, which runs:
     - `scripts/verify-playwright-test-boundary.test.mjs` (57 unit tests verifying invocation contexts, discovery boundaries, and syntax constraints).
     - `scripts/verify-playwright-test-boundary.mjs` (static code analysis over all tracked scripts, workflows, and Playwright spec files).
   - This verifier strictly ensures that:
     - All Playwright test files under `e2e/tests/` use `test.describe()`, `test()`, and Playwright hooks rather than bare globals (`describe`, `it`, `beforeAll`, etc.).
     - Foreign test runners or namespaces (`vitest`, `jest`, `node:test`) are never imported into Playwright specs.
     - Playwright is never launched from `frontend/` or without the explicit `e2e/playwright.config.ts` configuration.

3. **E2E Discovery Health**:
   - Verification via `(cd e2e && npx playwright test --list)` successfully discovers all 620 tests across 10 test suites without any `ReferenceError` or collection failures.
   - GitHub Actions workflow `.github/workflows/e2e-runner-context.yml` includes the `e2e / playwright-discovery` gate (`npm test -- --list` in `e2e/`), halting any pull request that introduces an invalid spec or unisolated invocation.

## Resolution

- **Explicit Behaviour**: No application code or configuration changes are required. The failure condition reported in Task 1674 (legacy swarm task 00871) has been remediated in earlier pull requests and is permanently prevented by `scripts/verify-playwright-test-boundary.mjs` and the CI discovery gate.
- **Rollout and Rollback**: No production, runtime, or infrastructure deployment is involved. Rollback is not applicable as this is a documentation and verification record confirming current repository health.
- **Observability and Testing**: Continuous verification is maintained via `npm run check:playwright-test-boundary` and `cd e2e && npm test -- --list`.
