# Frontend Cypress setup

Cypress is owned by the Angular application in `frontend/`. It is installed as a frontend development dependency and must not be moved to the repository root or the standalone Playwright package.

## Canonical configuration

The canonical configuration is `frontend/cypress.config.ts`:

- application base URL: `http://localhost:4200`
- support file: `cypress/support/e2e.ts`
- test files: `cypress/e2e/**/*.cy.ts`

The frontend package exposes these commands:

```bash
cd frontend
npm run cypress:open
npm run e2e
npm run e2e:ci
```

`npm run e2e:ci` starts the Angular development server and waits for port 4200 before running Cypress.

## Setup verification

The setup has a dependency-free verifier so package/configuration drift can be diagnosed before Cypress starts:

```bash
cd frontend
node scripts/verify-cypress-setup.mjs
node --test scripts/verify-cypress-setup.test.mjs
```

The verifier checks that:

- `cypress` and `start-server-and-test` are frontend development dependencies;
- `package-lock.json` contains matching root declarations and installed-package entries for both tools;
- the `cypress:open`, `e2e`, and `e2e:ci` scripts still invoke the intended runners;
- the canonical base URL, support file, and spec pattern remain configured;
- the support, commands, setup-smoke, and app-smoke files remain present.

Lockfile verification is deliberate. A package declaration without a matching lockfile can look configured locally but make `npm ci` fail in a clean checkout before Cypress ever starts.

## CI contract

`.github/workflows/cypress-frontend-contract.yml` verifies the frontend installation whenever Cypress configuration, package metadata, Cypress specs, the setup verifier, or the workflow itself changes. It:

1. installs the exact frontend lockfile with `npm ci`;
2. verifies the Cypress binary;
3. runs the reusable setup verifier and its Node regression tests;
4. starts the Angular app and runs `cypress-setup.cy.ts`, `app.cy.ts`, and `moments-flow.cy.ts` in Electron.

A failure means the Cypress installation/configuration is no longer usable from a clean checkout. Do not bypass the check with `continue-on-error` or by replacing the smoke test with a command that never starts the application.

The workflow intentionally uses synthetic/local application state and receives no production credentials. Setup verification is read-only and does not contact external services.

## Test ownership

Feature-heavy Angular browser flows already in `frontend/cypress/e2e` remain Cypress-owned. The standalone `e2e/` package is Playwright-owned and should be used for cross-browser, device-profile, RTL, or full-stack infrastructure coverage where that runner is specifically required. Avoid asserting the same product flow independently in both runners without a clear reason.

## Failure handling and observability

Keep installation/configuration failures distinct from product-flow failures:

- dependency or lockfile drift should fail in `verify-cypress-setup.mjs` with a specific contract message;
- a missing Cypress binary should fail at `npx cypress verify`;
- Angular startup or browser-flow failures should fail only after the static setup checks have passed.

This ordering keeps CI diagnostics actionable without logging browser session data, credentials, or private application content.

## Security and privacy

Cypress PR jobs must use synthetic test data and must not receive production credentials. Tests should intercept or use dedicated test services for privileged or external integrations. Never commit account tokens, Supabase service-role keys, provider secrets, or production session material to Cypress fixtures or configuration.

## Rollout and rollback

The setup verifier is additive and read-only. It can ship independently of product features because it only checks repository state already required by Cypress.

If the verification contract itself is incorrect, revert the verifier, its regression tests, workflow wiring, and this documentation together. Do not remove the frontend Cypress dependency, configuration, support file, or existing product specs as a rollback for an unrelated browser-test failure.
