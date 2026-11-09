# Issue 1851: QA Test Failure ReferenceError Investigation

## Overview

Task 1851 reports the legacy QA failure `ReferenceError: describe is not defined`
(originating from swarm queue file
`00860-186-fix-qa-test-failure-referenceerror-describe-is-not-defined-r.task`).

This is the same defect already investigated for issue 1674 in
`docs/investigation-1674-qa-test-failure-describe.md`. The analysis and safeguards
below are recorded so the duplicate task has an explicit, auditable resolution
rather than a competing implementation.

## Root Cause

The legacy `qa-loop.sh` ran `npx playwright test` from `frontend/`. That
directory has no `playwright.config.ts`, so Playwright fell back to its default
spec glob and discovered the Angular Vitest unit `*.spec.ts` files under
`frontend/src`. Those files use bare `describe`/`it` globals or
`import { vi } from 'vitest'`, neither of which exists under the Playwright
runner, producing `ReferenceError: describe is not defined` and the Vitest
`require()` import errors.

`ux-loop.sh` already targeted `e2e/` correctly. The defect was isolated to the
QA loop invocation context.

## Current State

The defect cannot recur in this repository because the obsolete bash swarm
scripts, including the root `qa-loop.sh`, were removed in commit `0e74e45df`
(`chore: remove obsolete bash swarm scripts in favor of swarmd.py`). Playwright
is now used only from the isolated `e2e/` package, which owns
`e2e/playwright.config.ts` and `e2e/tests/`.

Mechanical safeguards in place:

- `frontend/package.json` no longer depends on `@playwright/test`; Playwright is
  declared only in `e2e/package.json`.
- `scripts/verify-playwright-test-boundary.mjs` statically scans tracked shell
  scripts, workflows, `package.json` scripts and `e2e/` specs. It rejects any
  Playwright invocation that does not either run inside `e2e/` or pass an
  explicit `e2e/playwright.config.ts`, and it rejects foreign runner globals or
  imports inside Playwright specs.
- `scripts/verify-playwright-test-boundary.test.mjs` covers the historical
  `automation/qa-loop.sh` cases, including `(cd frontend && npx playwright test)`,
  root discovery without an explicit config, chained directory changes and
  pipeline-local directory changes.
- `npm run check:playwright-test-boundary` wires both scripts into
  `package.json`, and `.github/workflows/e2e-runner-context.yml` runs the check
  before `e2e/` discovery. `.github/workflows/playwright-test-boundary.yml` runs
  it as a dedicated gate.

## Verification Performed

- `node --test scripts/verify-playwright-test-boundary.test.mjs` passed all 63
  tests.
- `node scripts/verify-playwright-test-boundary.mjs` reported
  `Playwright test boundary verified`.
- `e2e/playwright.config.ts` sets `testDir: './tests'`, and `e2e/tests/`
  contains the real Playwright suites.

## Resolution

No further code or configuration change is required. The legacy QA loop file no
longer exists, and the current runner boundary is enforced automatically. This
task is a duplicate of issue 1674.

**Rollout and rollback:** documentation only; no runtime, schema or deployment
change, so rollback does not apply.

**Observability:** regressions surface through the Playwright test boundary gate
and the e2e discovery job before merge.
