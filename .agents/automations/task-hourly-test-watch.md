# Hourly Unit Test Watcher Fix

## Objective

Prevent test rot by ensuring the test suite remains 100% green.

## Instructions

1. Execute the Vitest suite in the `frontend/` (`npm test -- --watch=false`) and Vitest suite in the `backend/` (`npm test`).
2. If any tests are failing or throwing warnings, immediately diagnose and fix the broken logic or outdated mocks.
3. Review newly added feature files and ensure they have a corresponding `.spec.ts` file that asserts core functionality.
