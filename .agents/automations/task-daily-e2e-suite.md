# Daily E2E Test Suite Execution

## Objective
Validate the critical user flows (Discovery, Chat, Audio Rooms) from a true end-to-end perspective.

## Instructions
1. Execute each E2E suite from its own workspace, never from the repository root:
   - Cypress: `cd frontend && npm run e2e:ci`
   - Playwright: `cd e2e && npm test`
   - Backend API (`*.e2e-spec.ts`): `cd backend && npm run test:e2e`

   A `ReferenceError: describe is not defined` means a runner was started in the wrong directory, not that a product flow is broken. Relaunch it from the workspace above instead of editing specs (see `docs/playwright-test-boundary.md`).
2. Identify any flaky tests that occasionally fail due to race conditions, animation delays, or network latency.
3. Fix the flakiness by implementing robust wait conditions (e.g., waiting for specific DOM elements or Centrifugo connection states).
4. Ensure 100% pass rate before concluding the daily run.
