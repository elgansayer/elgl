# Weekly Dependency Security & Minor Update

## Objective
Keep the system secure and up-to-date with non-breaking patches.

## Instructions
1. Run `npm outdated` in both `frontend/` and `backend/`.
2. Safely upgrade minor and patch versions of key dependencies (e.g., `@angular/core`, `@nestjs/core`, `livekit-server-sdk`, `centrifuge`).
3. Ensure no major version bumps are executed automatically to prevent breaking changes.
4. Run the full verification test suite to ensure all unit tests, E2E tests, and builds pass.
