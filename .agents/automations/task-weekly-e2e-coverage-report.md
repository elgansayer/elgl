# Weekly E2E Coverage Gap Analysis

## Objective
Ensure critical user flows are protected from regressions.

## Instructions
1. Review the coverage of the E2E test suite.
2. Identify which new features merged this week lack automated end-to-end tests (e.g., a new gifting animation or VIP toggle).
3. Write a comprehensive E2E test to cover the most critical missing flow.
4. Execute the suite from its own workspace (`cd e2e && npm test` for Playwright, `cd frontend && npm run e2e:ci` for Cypress) to verify it is stable and non-flaky.
