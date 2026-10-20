# Admin user management

Issues #1058 and #1408 are implemented by the dedicated Angular application in `admin-portal/` and the versioned NestJS admin API under `/admin/v1`. This document records the supported user-management boundary so future work does not create a second admin application or bypass the capability model.

## Current product surface

The admin portal provides:

- `/users`: bounded user search with 20 rows per page, optional display-name search, loading/error/empty states, explicit retry, and links to user investigation.
- `/users/:id`: minimized operational user metadata including language, VIP, streak, activity, join date, and account identifiers needed for investigation.
- Optional login-history inspection when the signed-in operator has `users.sessions.read`.
- Separate moderation, roles, audit, logs, and system-health routes for higher-impact operations rather than placing privileged mutations on a generic user list.

The user list and detail routes require `users.read` in the Angular route guard. The backend independently enforces Supabase authentication, admin membership, and `AdminCapabilityGuard` with `users.read`; login history requires the stronger `users.sessions.read` capability.

## API contract

`AdminUsersService` is the browser boundary for user investigation:

- `GET /admin/v1/users?page=<n>&pageSize=<n>&search=<optional>`
- `GET /admin/v1/users/:id`
- `GET /admin/v1/users/:id/login-history`

Every request requires the in-memory admin bearer token. The service fails before making an HTTP request if no admin token is present. User identifiers are trimmed, bounded, and URL-encoded before they are placed in request paths.

Search input is trimmed before transmission, omitted when blank, and capped at 120 characters. Pagination is normalized client-side and independently bounded by the backend DTO; the portal requests 20 rows per page and never accepts a response page larger than 100 rows.

The browser treats every privileged API response as untrusted input. User-list, user-detail, and login-history payloads are structurally validated before entering Angular state. Response arrays, identifiers, language arrays, dates, numeric counters, URL fields, IP-address strings, and user-agent strings all have explicit bounds. Invalid or oversized payloads fail closed instead of being partially rendered.

## Security and privacy

The user-management portal is an investigation surface, not a general database browser.

- Browser code never queries Supabase user tables directly.
- The general `users.read` response intentionally excludes credentials, authentication tokens, unrestricted private profile content, and raw session data.
- Login history is separated behind `users.sessions.read` and the backend returns a privacy-scrubbed, bounded history of at most 50 entries.
- High-impact actions such as moderation and role assignment remain on capability-specific APIs and screens with their own authorization and audit requirements.
- HTTP and provider failures are converted to a stable unavailable state before reaching the page. Raw database URLs, credentials, stack traces, and provider exception text are never rendered by the user-management screen.
- Avatar metadata is accepted only when absent or represented by an absolute HTTP(S) URL; active or non-web URL schemes are rejected at the client trust boundary.
- API/provider failures must never fabricate user records, login history, or successful privileged actions.

## Accessibility and failure behaviour

The search page uses a semantic search form, labelled input, native buttons, an `aria-live` result summary, an alert on failures, semantic definition lists for metadata, native profile links, and bounded Previous/Next pagination. The mobile layout stacks search controls below 36rem and user-card content wraps rather than overflowing.

A failed search clears stale privileged results and leaves both the search form and an explicit Retry search action available. The visible failure message is intentionally generic and does not mirror arbitrary exception text. Request generations prevent an older programmatic search from overwriting a newer result or clearing its busy state. A failed user-detail lookup shows an unavailable state and a safe return path. Login-history failure does not replace or invalidate the already-loaded user summary.

## Verification

The admin user-management contract is covered by:

- `admin-portal/src/app/admin.routes.spec.ts`: user routes remain capability-gated.
- `admin-portal/src/app/admin-users.service.spec.ts`: authentication, endpoint, encoding, query bounds, response validation, provider-error sanitization, user-detail validation, and login-history limits.
- `admin-portal/src/app/pages/users-page.component.spec.ts`: initial loading, rendered metadata, new-search reset, bounded pagination, privacy-safe failure state, and retry behavior.
- Backend admin controller/service tests and repository CI for server-side capability enforcement, audit behavior, and bounded query behavior.

The admin portal test builder uses `tsconfig.spec.json` so component/service specs are compiled and type-checked as part of `ng test`. The dedicated admin workflow installs with the same legacy-peer resolution mode as canonical CI so its clean install is reproducible from the current lockfile.

Run from `admin-portal/`:

```bash
npm test
npm run lint:check
npm run build
```

Repository CI remains authoritative for the combined frontend/backend/admin verification gate.

## Rollout and rollback

The #1408 completion hardens the existing user-management application rather than creating a parallel admin UI. It has no database migration, backend API shape change, new permission, or persisted-data rewrite. It can be deployed independently of backend changes because it only narrows what the browser accepts from the established versioned API.

Rollback is a normal revert of the focused frontend and documentation commits. Do not weaken the server-side admin guards, merge login-history access into `users.read`, or reintroduce synthetic/fallback user records as a rollback shortcut.
