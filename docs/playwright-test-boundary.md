# Playwright test-runner boundary

## Purpose

ELGL has two different JavaScript test-runner families with deliberately separate discovery roots:

- Angular unit/component tests live under `frontend/src/**` and run through Angular/Vitest.
- Browser E2E tests live under `e2e/tests/**` and run through Playwright using `e2e/playwright.config.ts`.

Vitest-style code can reach a Playwright run in two ways. Both surface as the same misleading failure, `ReferenceError: describe is not defined`, and neither is an application defect:

1. **Wrong discovery root.** Running `playwright test` from `frontend/` (or from the repository root without an explicit E2E config) lets Playwright fall back to broad default discovery. It can then execute Angular `*.spec.ts` files as Playwright tests. Those files legitimately use Vitest globals such as `describe` and `it`.
2. **Wrong API inside the right root.** A spec under `e2e/tests/**` that calls `describe`, `it` or a hook as a bare global, uses `vi` or `jest`, or imports another test runner fails inside Playwright, which only exposes these helpers on `test` (for example `test.describe`). Playwright loads every spec before it runs any test, so a single bad file makes the whole run exit non-zero with no tests executed, including the valid specs beside it. `vi` and `jest` calls inside a test body fail later, at runtime, after the web servers are already up.

## Enforced contract

`npm run check:playwright-test-boundary` verifies all of the following:

1. `e2e/playwright.config.ts` pins `testDir` to `./tests`.
2. `e2e/package.json` owns both the canonical `playwright test` script and the `@playwright/test` dependency.
3. Scripts and workflows may invoke `playwright test` only when they run from `e2e/` or supply `--config e2e/playwright.config.ts` explicitly.
4. Frontend unit-test files must not import `@playwright/test`.
5. Playwright specs (every `*.spec.*` and `*.test.*` file under `e2e/tests/` that Playwright discovers) use only Playwright's own runner API: no bare `describe`, `it`, `beforeAll`, `beforeEach`, `afterAll` or `afterEach` calls, no `vi` or `jest` namespaces, and no imports from `vitest`, `@jest/globals` or `node:test`.

The same command also enforces the authentication boundary described in [E2E authentication boundary](./e2e-login-boundary.md).

The check is part of the root `npm run verify` chain, so a future QA loop, workflow, or package-script regression fails before it can misclassify Vitest suites as Playwright tests.

## What the check reads

The check reads the working tree as Git lists it: tracked files plus untracked files that `.gitignore` does not exclude (`git ls-files --cached --others --exclude-standard`), always taking the content from disk. Playwright also discovers specs from disk, so a spec that a QA run or an editing session has written but not yet committed is rejected before it can fail the Playwright run.

Two edge cases are deliberate:

- A tracked file that has been deleted from disk, with the deletion not yet staged, is skipped. Playwright cannot discover it, and deleting a broken spec is the usual fix.
- A file that Git ignores is not scanned. This keeps dependency trees and generated reports out of the scan, but it also means a spec under an ignored path is not covered. `cd e2e && npx playwright test --list` remains the authoritative discovery result.

## Authoring Playwright specs

Translate unit-test habits to the Playwright equivalent before adding a spec:

| Unit-test habit                                    | Playwright equivalent                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `describe(...)`                                    | `test.describe(...)`                                                   |
| `it(...)`                                          | `test(...)`                                                            |
| `beforeAll`, `beforeEach`, `afterEach`, `afterAll` | `test.beforeAll`, `test.beforeEach`, `test.afterEach`, `test.afterAll` |
| Vitest/Jest spies and module replacements          | `page.route()` for network interception and plain recording closures   |

A spec may bind a runner name to Playwright's API locally (for example `const { describe } = test;`) and the check accepts it, but `test.describe` is the repository convention. Names that appear only in comments or string literals are ignored.

## Triage for `ReferenceError: describe is not defined`

Read the file path in the stack trace first:

- Under `frontend/src/`: Playwright was launched from the wrong directory. Use one of the safe invocation patterns below.
- Under `e2e/tests/`: the spec uses Vitest or Jest style. Run `npm run check:playwright-test-boundary`; it names the file, the line and the Playwright replacement.

To reproduce locally, run `cd e2e && npx playwright test --list`. A load error prints the `ReferenceError` and lists `Total: 0 tests`. Do not raise timeouts, retry the run, or file the failure as a product bug.

### The error recurs although the invocation is correct

When the QA command already runs from `e2e/` (`(cd e2e && npx playwright test)`), a recurrence is not the wrong-root defect returning. The file in the stack trace is a spec that was loaded during that run. A QA run writes specs into `e2e/tests/` before anything is committed, and a later `--list` is clean once the spec has been fixed or removed, so the run looks unreproducible.

`npm run check:playwright-test-boundary` covers this case because it reads uncommitted specs. Before it did, it listed only tracked files: with an untracked spec containing a bare `describe(...)`, the check printed "verified" while `cd e2e && npx playwright test --list` failed with `ReferenceError: describe is not defined` and `Total: 0 tests in 0 files`. If the check passes and the stack trace still names a spec under `e2e/tests/`, look for a file Git ignores, or for a non-spec helper that a spec imports (only `*.spec.*` and `*.test.*` files are scanned).

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

The verifier reports the file and line containing an unsafe invocation or a bare runner global, and names the Playwright replacement. Each runner global is reported once per file, at its first use, so the output stays bounded even when a whole unit-test file has been pasted into `e2e/tests/`. It reads source text only and intentionally does not print environment values, test payloads, browser traces, credentials, or application data.

The `e2e / playwright-discovery` job in the E2E Runner Context workflow runs `npm test -- --list` from `e2e/` and rejects a spec that fails to load, reporting the raw `ReferenceError` stack after the E2E dependencies are installed. The static check complements it: it needs nothing beyond Node.js, so it also runs in `npm run verify` and in the dedicated Playwright Test Boundary workflow, and it names the Playwright replacement. It additionally catches `vi` and `jest` calls that `--list` cannot see because they only fail while a test body executes.

A failed boundary check is a configuration failure, not a product outage. Correct the invocation/configuration and rerun verification; no database, cache, or user-data recovery is needed.

## Rollout and rollback

This change is CI/developer-tooling only and introduces no runtime API, schema, persistence, authentication, or UI changes. It is safe to deploy independently of application services.

Because the verifier reads uncommitted files, a local run can report a scratch spec or script that CI never sees. Fix or delete that file. CI runs on a clean checkout and behaves exactly as before.

Rollback is code-only: revert the verifier, tests, and package-script wiring. The canonical `e2e/` Playwright layout should remain in place even during rollback because moving Playwright discovery back into the frontend recreates the original test-runner collision.
