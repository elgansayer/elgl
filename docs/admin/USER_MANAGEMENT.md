# Admin user management

Issue #1058 is implemented by the dedicated Angular application in `admin-portal/` and the versioned NestJS admin API under `/admin/v1`. This document records the supported user-management boundary so future work does not create a second admin application or bypass the capability model.

## Current product surface

The admin portal provides:

- `/users`: bounded user search with 20 rows per page, optional display-name search, loading/error/empty states, and links to user investigation.
- `/users/:id`: minimized operational user metadata including language, VIP, streak, activity, join date, and account identifiers needed for investigation.
- Optional login-history inspection when the signed-in operator has `users.sessions.read`.
- Separate moderation, roles, audit, logs, and system-health routes for higher-impact operations rather than placing privileged mutations on a generic user list.

The user list and detail routes require `users.read` in the Angular route guard. The backend independently enforces Supabase authentication, admin membership, and `AdminCapabilityGuard` with `users.read`; login history requires the stronger `users.sessions.read` capability.

## API contract

`AdminUsersService` is the browser boundary for user investigation:

- `GET /admin/v1/users?page=<n>&pageSize=<n>&search=<optional>`
- `GET /admin/v1/users/:id`
- `GET /admin/v1/users/:id/login-history`

Every request requires the in-memory admin bearer token. The service fails before making an HTTP request if no admin token is present. User identifiers are URL-encoded before they are placed in request paths.

Search input is trimmed before transmission and omitted when blank. Pagination is bounded by the backend DTO and the portal requests 20 rows per page.

## Security and privacy

The user-management portal is an investigation surface, not a general database browser.

- Browser code never queries Supabase user tables directly.
- The general `users.read` response intentionally excludes credentials, authentication tokens, unrestricted private profile content, and raw session data.
- Login history is separated behind `users.sessions.read` and the backend returns a privacy-scrubbed, bounded history.
- High-impact actions such as moderation and role assignment remain on capability-specific APIs and screens with their own authorization and audit requirements.
- API/provider failures are surfaced as unavailable states; the portal must not fabricate user records or successful privileged actions.

## Accessibility and failure behaviour

The search page uses a semantic search form, labelled input, native buttons, an `aria-live` result summary, an alert on failures, semantic definition lists for metadata, native profile links, and bounded Previous/Next pagination. The mobile layout stacks search controls below 36rem and user-card content wraps rather than overflowing.

A failed search clears stale results and leaves the search form available for retry. A failed user-detail lookup shows an alert and a safe return path. Login-history failure does not replace or invalidate the already-loaded user summary.

## Verification

The admin user-management contract is covered by:

- `admin-portal/src/app/admin.routes.spec.ts`: user routes remain capability-gated.
- `admin-portal/src/app/admin-users.service.spec.ts`: authentication, endpoint, encoding, search, and pagination request contracts.
- `admin-portal/src/app/pages/users-page.component.spec.ts`: initial loading, rendered metadata, new-search reset, bounded pagination, and failure state.
- Backend admin controller/service tests and repository CI for server-side capability enforcement and bounded query behaviour.

The admin portal test builder uses `tsconfig.spec.json` so component/service specs are compiled and type-checked as part of `ng test`. The dedicated admin workflow installs with the same legacy-peer resolution mode as canonical CI so its clean install is reproducible from the current lockfile.

Run from `admin-portal/`:

```bash
npm test
npm run lint:check
npm run build
```

Repository CI remains authoritative for the combined frontend/backend/admin verification gate.

## Rollout and rollback

This completion adds regression coverage and repairs the admin portal test/CI harness around the existing production user-management surface. It has no database migration, API shape change, new permission, or product runtime rollout requirement.

Rollback is a normal revert of the test/documentation/configuration commit. Do not weaken the server-side admin guards or merge login-history access into `users.read` as a rollback shortcut.
