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
3. Tracked scripts/workflows may invoke `playwright test` only when that same command establishes the E2E context: it changes into `e2e/` first, it passes `--config e2e/playwright.config.ts`, or, in a GitHub Actions workflow, the same step sets `working-directory: e2e`. Context that belongs to a neighbouring line or step does not count.
4. Frontend unit-test files must not import `@playwright/test`.

The check is part of the root `npm run verify` chain, so a future QA loop, workflow, or package-script regression fails before it can misclassify Vitest suites as Playwright tests.

### Why the context must belong to the invocation

An earlier version of the check accepted any `cd e2e`, `--config` or `working-directory: e2e` within ten lines of an invocation. That let a workflow step that copied its neighbour's install step (`working-directory: e2e`) but forgot its own, or a script that ran `(cd e2e && npm ci)` before a bare `npx playwright test`, pass verification while still starting Playwright at the repository root. That is the exact launch context that produces `ReferenceError: describe is not defined`.

The check now reads the context from the command itself or from the workflow step that owns it:

- shell continuations (a trailing backslash) are joined, so an invocation split across two lines is still found;
- the innermost `cd` still in effect before the invocation on the same command must end in `e2e`; a `cd` inside a subshell that has already closed no longer applies, so `(cd e2e && npm ci) && npx playwright test` is rejected;
- `--config e2e/playwright.config.ts` must be part of the same command;
- `working-directory: e2e` must be a key of the same workflow step as the `run` script, whichever side of `run` it sits on, and a `cd` in the command itself takes precedence over it;
- full-line `#` and `//` comments are ignored, so a warning such as "never run `npx playwright test` from the repository root" can sit next to the invocation it describes.

## Safe invocation patterns

Use one of these forms from automation:

```sh
(cd e2e && npx playwright test)
```

or:

```sh
npx playwright test --config e2e/playwright.config.ts
```

GitHub Actions may instead set `working-directory: e2e` on the step running `npx playwright test`:

```yaml
- name: Run Playwright
  run: npx playwright test
  working-directory: e2e
```

Do not run bare `npx playwright test` from `frontend/` or the repository root.

Other ways of reaching `e2e/` are not recognised and are reported: a `cd` on an earlier line than the invocation, `pushd`, `env -C`, `npm --prefix`, and a job-level `defaults.run.working-directory`. Rewrite them as one of the forms above. The check is a tripwire over tracked text, not a shell interpreter, so it deliberately prefers a small set of explicit forms to guessing at shell semantics.

## Triage: `ReferenceError: describe is not defined`

The message means a spec written for one runner was loaded by another. It is a launch-context failure, never a product defect. Do not silence it by importing Vitest globals into Angular specs, shimming `describe`, adding a Playwright config to `frontend/`, or raising timeouts.

- **From Playwright:** Playwright was started outside `e2e/` and discovered Angular and NestJS `*.spec.ts` files. Confirm with `(cd e2e && npm test -- --list)`, which lists only files under `e2e/tests`, then find the script or workflow that launched it with `npm run check:playwright-test-boundary`. The retired swarm QA loop misreported this failure as a bug 48 cycles running because it started Playwright from `frontend/`; automatically generated issues with this title trace back to it.
- **From Vitest:** the workspace was run with `vitest` directly and without `globals: true`. `frontend/` and `backend/` enable it in their Vitest configs, and `ng test` (frontend and `admin-portal`) enables it through the Angular builder. Use the workspace's own `npm test` script instead.

## Failure handling and observability

The verifier reports the tracked file and line containing an unsafe invocation, followed by the accepted forms. It intentionally does not print environment values, test payloads, browser traces, credentials, or application data.

A failed boundary check is a configuration failure, not a product outage. Correct the invocation/configuration and rerun verification; no database, cache, or user-data recovery is needed.

## Verification

```sh
npm run check:playwright-test-boundary
(cd e2e && npm test -- --list)
```

The first command runs the verifier's regression tests and scans every tracked script and workflow. The second is the canonical discovery check, also run by the E2E Runner Context workflow and by Factory verification when `e2e/` changes; it must list only specs under `e2e/tests` and exit successfully.

## Rollout and rollback

This change is CI/developer-tooling only and introduces no runtime API, schema, persistence, authentication, or UI changes. It is safe to deploy independently of application services.

Rollback is code-only: revert the verifier, tests, and package-script wiring. Reverting only the same-command scoping restores the earlier ten-line context window, which is more permissive; prefer rewriting a rejected invocation over relaxing the rule. The canonical `e2e/` Playwright layout should remain in place even during rollback because moving Playwright discovery back into the frontend recreates the original test-runner collision.
