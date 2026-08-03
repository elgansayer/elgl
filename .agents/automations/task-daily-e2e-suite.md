# Daily E2E Test Suite Execution

## Objective
Validate the critical user flows (Discovery, Chat, Audio Rooms) from a true end-to-end perspective.

## Instructions
1. Execute the E2E test suite (e.g., Cypress, Playwright, or backend `*.e2e-spec.ts`).
2. Identify any flaky tests that occasionally fail due to race conditions, animation delays, or network latency.
3. Fix the flakiness by implementing robust wait conditions (e.g., waiting for specific DOM elements or Centrifugo connection states).
4. Ensure 100% pass rate before concluding the daily run.
