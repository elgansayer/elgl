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

## CI contract

`.github/workflows/cypress-frontend-contract.yml` verifies the frontend installation whenever Cypress configuration, package metadata, Cypress specs, or the workflow itself changes. It:

1. installs the exact frontend lockfile with `npm ci`;
2. verifies the Cypress binary;
3. checks the package scripts and canonical Cypress paths;
4. starts the Angular app and runs `cypress/e2e/app.cy.ts` in Electron.

A failure means the Cypress installation/configuration is no longer usable from a clean checkout. Do not bypass the check with `continue-on-error` or by replacing the smoke test with a command that never starts the application.

## Test ownership

Feature-heavy Angular browser flows already in `frontend/cypress/e2e` remain Cypress-owned. The standalone `e2e/` package is Playwright-owned and should be used for cross-browser, device-profile, RTL, or full-stack infrastructure coverage where that runner is specifically required. Avoid asserting the same product flow independently in both runners without a clear reason.

## Security and privacy

Cypress PR jobs must use synthetic test data and must not receive production credentials. Tests should intercept or use dedicated test services for privileged or external integrations. Never commit account tokens, Supabase service-role keys, provider secrets, or production session material to Cypress fixtures or configuration.

## Rollback

If the Cypress contract workflow itself causes an infrastructure regression, revert the workflow/documentation commit. Do not remove the frontend Cypress dependency, configuration, support file, or existing tests as a rollback for an unrelated product failure.
