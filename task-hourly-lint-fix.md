# Hourly Lint & Auto-Fix

## Objective
Keep the codebase impeccably clean and perfectly formatted every hour.

## Instructions
1. Run `npm run lint -- --fix` in both the `frontend/` and `backend/` workspaces.
2. Identify any unresolved linting errors (such as `no-console` or explicit `any` usage) and manually correct them.
3. Verify that Prettier formatting aligns with the project's `.prettierrc`.
4. Ensure the verification gate passes cleanly.
