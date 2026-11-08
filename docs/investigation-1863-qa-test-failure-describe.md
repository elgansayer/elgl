# Issue 1863: QA Test Failure ReferenceError Investigation

## Overview

Task 1863 requests:
"Identify and fix the specific test file causing ReferenceError: describe is not defined (need the failing test file path added to the chat)."
(Originating from local swarm queue file `00872-185-identify-and-fix-the-specific-test-file-causing-referenceerr.task`).

This task represents the third iteration of the legacy swarm QA failure previously analysed under:
- Issue 1674 (`00871-473-fix-qa-test-failure-referenceerror-describe-is-not-defined-i.task`, documented in `docs/investigation-1674-qa-test-failure-describe.md`)
- Issue 1851 (`00860-186-fix-qa-test-failure-referenceerror-describe-is-not-defined-r.task`, documented in `docs/investigation-1851-qa-test-failure-describe.md`)

This investigation records the exact failing test file paths, the operational root cause, why the defect was not isolated to any single spec file, and why the swarm prompt specifically asked for the failing test file path to be added to the chat.

## Identified Failing Test File Paths

When the failure occurred historically, the following test file paths were implicated:

1. **First Alphabetical Discovery Target:**
   `frontend/src/app/achievements/achievements.component.spec.ts`
   When Playwright was invoked within `frontend/` without a `playwright.config.ts`, it applied its default test discovery glob (`.*(test|spec)\.(js|ts|mjs|cjs|jsx|tsx)`). Alphabetically, `achievements.component.spec.ts` was the first spec encountered in `frontend/src/app/`. Playwright attempted to execute it as a Playwright test and immediately failed with `ReferenceError: describe is not defined`.

2. **Full Frontend Vitest Suite Spectrum:**
   Every Angular unit test file matching `frontend/src/**/*.spec.ts` (including `frontend/src/app/app.component.spec.ts`, `frontend/src/app/chat/chat.component.spec.ts`, etc.) relies on Vitest globals (`describe`, `it`, `beforeEach`, `afterEach`, `expect`). None of these files are broken under Vitest (`frontend/vitest.config.ts` sets `globals: true`), but all fail under Playwright because Playwright does not expose `describe` as a bare global.

3. **Historically Misidentified Spec File:**
   `frontend/src/app/services/vocabulary.store.spec.ts`
   In historical commit `bdb521b9a`, an automated agent attempted to fix the error by adding `import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';` directly into `vocabulary.store.spec.ts`. This was ineffective because the root cause was the runner execution context, not an individual spec file.

4. **Potential E2E Spec Boundary Violations:**
   Any Playwright test in `e2e/tests/**/*.spec.ts` that erroneously calls `describe()` instead of `test.describe()`. A regression suite fixture exists at `e2e/tests/adversarial/bare-describe.spec.ts` in the test boundary analyser to verify detection of this case.

## Root Cause Analysis

1. **Incorrect Execution Directory & Missing Config:**
   The legacy bash swarm runner (`qa-loop.sh`) historically ran `npx playwright test` inside `frontend/`. Because `frontend/` contains no `playwright.config.ts`, Playwright defaulted to searching all nested folders, discovering Angular unit tests in `frontend/src/`. Under Playwright, tests must use `test.describe()` from `@playwright/test`, rather than bare `describe()`.

2. **Unbounded Log Accumulation & Stale Triage Matching:**
   In `qa-loop.sh`, test output was redirected via `>> qa_errors.log` without truncation between iterations. The triage parser:
   `grep -E -A 5 "Error:|failed" qa_errors.log | head -n 1`
   continuously matched the very first error in the file: the historical `ReferenceError: describe is not defined`. Because the grep expression truncated the preceding stack trace and file path header, the autonomous swarm was unable to identify which file had failed. Consequently, the swarm generated task `00872-185` with the literal note:
   `(need the failing test file path added to the chat)`.

## Current Repository Safeguards

The defect is entirely resolved and mechanically guarded against recurrence:

1. **Removal of Obsolete Swarm Scripts:**
   The legacy bash scripts (`qa-loop.sh`, `pm-loop.sh`) were removed in commit `0e74e45df` and subsequent cleanup commits.

2. **Dependency Boundary:**
   `@playwright/test` was removed from `frontend/package.json` (commit `2db477e98`, PR #3260). Playwright dependencies reside strictly in `e2e/package.json`.

3. **Automated Boundary Verification:**
   `scripts/verify-playwright-test-boundary.mjs` scans all tracked scripts, workflows, package configurations, and specs. It ensures:
   - Playwright is never launched from `frontend/` or from root without `--config e2e/playwright.config.ts`.
   - Playwright specs in `e2e/tests/` never call bare `describe()` or import foreign runners (`vitest`, `jest`, `node:test`).
   - Unit tests under `frontend/src/` are isolated to Angular/Vitest.

4. **Continuous Test Gate:**
   `scripts/verify-playwright-test-boundary.test.mjs` contains 64 unit tests validating all boundary constraints. CI workflows `.github/workflows/playwright-test-boundary.yml` and `.github/workflows/e2e-runner-context.yml` run on all pull requests.

## Resolution

- **Explicit Behaviour:** All identified test paths and root causes have been documented. No individual test file is broken or requires modification because the defect was a runner boundary issue, not a test defect.
- **Rollout and Rollback:** Documentation and boundary test coverage only. No production runtime changes are involved; rollback is not applicable.
- **Testing and Observability:** Verified via `node --test scripts/verify-playwright-test-boundary.test.mjs` and `node scripts/verify-playwright-test-boundary.mjs`.
