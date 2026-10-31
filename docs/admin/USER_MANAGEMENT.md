# Admin user management

Issues #1058, #1408 and #1746 all ask for the admin portal for user management. They are implemented by the dedicated Angular application in `admin-portal/` and the versioned NestJS admin API under `/admin/v1`. This document records the supported user-management boundary so future work does not create a second admin application or bypass the capability model.

#1746 is a third request with the same title. It added no parallel application: it closed the failure-state, test and accessibility gaps left in the existing surface (see [Failure states](#failure-states)) and recorded why account enforcement is not part of it (see [Account enforcement is not part of this surface](#account-enforcement-is-not-part-of-this-surface)).

## Current product surface

The admin portal provides:

- `/users`: bounded user search with 20 rows per page, optional display-name search, loading/error/empty states, explicit retry where a retry can help, and links to user investigation.
- An "Open a user by ID" form on `/users` for the common case where an operator already holds an identifier from a report, a ticket or a log line. It validates the canonical UUID format in the browser and navigates to `/users/:id`; it never calls the API itself and never guesses.
- `/users/:id`: minimised operational user metadata including language, VIP, streak, activity, join date, and account identifiers needed for investigation.
- Optional login-history inspection when the signed-in operator has `users.sessions.read`.
- Separate moderation, roles, audit, logs, and system-health routes for higher-impact operations rather than placing privileged mutations on a generic user list.

The user list and detail routes require `users.read` in the Angular route guard. The backend independently enforces Supabase authentication, admin membership, and `AdminCapabilityGuard` with `users.read`; login history requires the stronger `users.sessions.read` capability.

## API contract

`AdminUsersService` is the browser boundary for user investigation:

- `GET /admin/v1/users?page=<n>&pageSize=<n>&search=<optional>`
- `GET /admin/v1/users/:id`
- `GET /admin/v1/users/:id/login-history`

Every request requires the in-memory admin bearer token. The service fails before making an HTTP request if no admin token is present. User identifiers are trimmed, bounded, and URL-encoded before they are placed in request paths.

Search input is trimmed before transmission, omitted when blank, and capped at 120 characters. Pagination is normalised client-side and independently bounded by the backend DTO; the portal requests 20 rows per page and never accepts a response page larger than 100 rows.

The browser treats every privileged API response as untrusted input. User-list, user-detail, and login-history payloads are structurally validated before entering Angular state. Response arrays, identifiers, language arrays, dates, numeric counters, URL fields, IP-address strings, and user-agent strings all have explicit bounds. Invalid or oversized payloads fail closed instead of being partially rendered.

### Server-side failure semantics

Storage failures are never reported as data:

| Request | Outcome | Status |
| --- | --- | --- |
| `GET /admin/v1/users` | rows (possibly none) | 200 |
| `GET /admin/v1/users` | storage query failed | 503 `Admin user data unavailable` |
| `GET /admin/v1/users/:id` | user found | 200 |
| `GET /admin/v1/users/:id` | no such user, or an identifier that is not a UUID | 404 `User not found` |
| `GET /admin/v1/users/:id` | storage query failed | 503 `Admin user data unavailable` |

Before #1746 a failed list query answered `200` with an empty list, so an outage read as "no matching users", and a failed detail query answered `404`, so an outage read as "this user does not exist". A malformed identifier is answered `404` without querying, because PostgreSQL would reject it as a syntax error that is indistinguishable from an outage.

The same `AdminService.listUsers` also backs the legacy `GET /admin/users` route. The consumer app's admin access probe (`GET /admin/users?page=1&pageSize=1`) therefore now treats a storage outage as "cannot verify access" and denies the admin surface, which is the fail-closed behaviour [SECURITY.md](SECURITY.md) already specifies for provider failures.

Every user read is audited by the global admin audit interceptor (actor, capability, target, outcome, correlation ID). The three browser-facing user reads (`users`, `users/:id`, `users/:id/login-history`) also answer `Cache-Control: private, no-store` and `CDN-Cache-Control: private, no-store`, so browsers and intermediaries never store user metadata.

## Failure states

The portal reduces every failure to one of four states. Provider, database and transport detail never reaches the page.

| Cause | State | What the operator sees |
| --- | --- | --- |
| No token held in memory | `unauthenticated` | "Your admin session has expired. Sign in again to continue." with a sign-in link. No request is sent. |
| HTTP 401 | `unauthenticated` | The same message. The dead token is dropped so the route guard sends later navigation to sign-in; retrying could never succeed. |
| HTTP 403 | `forbidden` | A "not permitted" message with a way back. No retry is offered and the session is kept. |
| HTTP 404 on `/users/:id`, or a malformed identifier | `not-found` | "No user matches this identifier." with a link back to search. |
| HTTP 404 on the list or login history, 429, 5xx, network failure, malformed or oversized payload, unavailable runtime configuration | `unavailable` | "Temporarily unavailable. Try again." with an explicit retry. |

Details that matter in practice:

- A failed search clears stale privileged results. Search and ID-lookup forms stay available.
- A failed user-detail lookup offers a retry for outages and a safe return path for every state.
- Login-history failure does not replace or invalidate the already-loaded user summary. An outage offers "Try again"; a refused or expired state does not.
- Request generations prevent an older programmatic search from overwriting a newer result or clearing its busy state.

## Security and privacy

The user-management portal is an investigation surface, not a general database browser.

- Browser code never queries Supabase user tables directly.
- The general `users.read` response intentionally excludes credentials, authentication tokens, unrestricted private profile content, and raw session data.
- Login history is separated behind `users.sessions.read` and the backend returns a privacy-scrubbed, bounded history of at most 50 entries.
- High-impact actions such as moderation and role assignment remain on capability-specific APIs and screens with their own authorisation and audit requirements.
- HTTP and provider failures are converted to a stable state before reaching the page. Raw database URLs, credentials, stack traces, and provider exception text are never rendered by the user-management screen.
- Avatar metadata is accepted only when absent or represented by an absolute HTTP(S) URL; active or non-web URL schemes are rejected at the client trust boundary.
- API/provider failures must never fabricate user records, login history, or successful privileged actions.

## Observability

- A storage failure on the user list or detail read increments `hellotalk_admin_api_errors_total{endpoint="users",error_type="database_error"}` and logs the sanitised query error through the structured application logger. Alert on a sustained non-zero rate.
- Successful uncached list reads and detail reads record `hellotalk_admin_api_latency_seconds{endpoint="users",action="listUsers"|"getUser"}`. Redis cache hits are not timed.
- Each privileged read lands in `admin_audit_events` with the request correlation ID, so a portal failure can be correlated without database access.

## Accessibility

The search page uses a semantic search form, labelled inputs, native buttons, a persistent `role="status"` region for the result summary, an alert on failures, semantic definition lists for metadata, native profile links, and bounded Previous/Next pagination.

- The result summary lives in a status region that is always in the DOM, so screen readers announce its updates; a region inserted together with its text is often not announced.
- Each result card exposes one link, on the user's name. A second "Inspect user" link per card produced a list of identical link names with different destinations.
- The ID lookup field is labelled, reports validation errors through `aria-invalid`, `aria-describedby` and an alert, and does not rely on colour.
- Failure states state their cause in text and offer only actions that can help.
- The mobile layout stacks search controls below 36rem and user-card content wraps rather than overflowing.

## Account enforcement is not part of this surface

The portal gives operators investigation and navigation, not enforcement. Suspending, restricting, locking or restoring an account is deliberately absent, because the platform has no enforcement model for it yet and a control that records intent without enforcing it would be a fabricated privileged action.

- There is no persisted account restriction (state, scope, expiry, reason, actor), and nothing in `SupabaseAuthGuard`, realtime token issuance or the room and call services reads one.
- The legacy `POST /admin/users/:id/ban` only inserts a `blocks` row from the operator's own account to the target, and `POST /admin/users/:id/warn` only inserts an `admin_warning` report. Neither stops the target using the platform, so the portal must not present them as bans, suspensions or warnings delivered to the user.
- The prerequisites that [EXECUTION_ROADMAP.md](EXECUTION_ROADMAP.md) lists for medium and high-impact mutations are not in place on `/admin/v1`: mandatory reason-code DTOs, idempotency keys with optimistic concurrency, step-up authentication, and independent approval for destructive or broad actions.

A future issue that adds restrictions needs, in this order: a migration for a time-bounded, reversible restriction record with an expiry and an append-only history; enforcement in the authentication boundary and realtime token issuance with a bounded cache; `/admin/v1` mutations behind a dedicated capability that require a reason code and idempotency key and are audited; and only then portal controls with explicit target, scope and consequence confirmation. Do not add portal buttons ahead of that backend.

## Verification

The admin user-management contract is covered by:

- `admin-portal/src/app/admin.routes.spec.ts`: user routes remain capability-gated.
- `admin-portal/src/app/admin-capability.guard.spec.ts`: no token redirects to sign-in without probing the API; a held capability is allowed; a missing capability redirects to access denied; a context that cannot be loaded fails closed.
- `admin-portal/src/app/admin-auth-context.service.spec.ts`: the `me` request, bearer use, capability checks, clearing, and refusal without a token.
- `admin-portal/src/app/admin-users.service.spec.ts`: authentication, endpoint, encoding, query bounds, response validation, provider-error sanitisation, user-detail validation, login-history limits, and the failure classification table above including token drop on 401.
- `admin-portal/src/app/pages/users-page.component.spec.ts`: initial loading, rendered metadata, new-search reset, bounded pagination, the failure states and their actions, retry behaviour, the persistent status region, single link per card, and ID lookup validation and navigation.
- `admin-portal/src/app/pages/user-detail-page.component.spec.ts`: metadata rendering, capability-gated login history, every user and history failure state, retries, and sanitisation of unexpected errors.
- `backend/src/admin/admin.service.spec.ts`: 503 instead of an empty success, 404 versus 503 on detail, malformed identifiers answered without a query, and the failure and latency metrics.
- `backend/src/admin/admin-v1.controller.spec.ts`: delegation, audit behaviour and the no-store headers on the three user reads.
- Backend admin controller and guard tests and repository CI for server-side capability enforcement, audit behaviour, and bounded query behaviour.

The admin portal test builder uses `tsconfig.spec.json` so component/service specs are compiled and type-checked as part of `ng test`. The dedicated admin workflow installs with the same legacy-peer resolution mode as canonical CI so its clean install is reproducible from the current lockfile.

Run from `admin-portal/`:

```bash
npm test
npm run lint:check
npm run build
```

Run from `backend/`:

```bash
npx vitest run src/admin
```

Repository CI remains authoritative for the combined frontend/backend/admin verification gate.

## Rollout and rollback

There is no database migration, new permission, new route, new environment variable or persisted-data rewrite. The backend and the portal can be deployed in either order:

- New portal with an old backend: a storage outage still looks like an empty list, exactly as before. Nothing gets worse.
- Old portal with a new backend: the old portal maps every failure to its generic unavailable state, so the new `503` and `404` semantics render as before.
- Consumer admin guard with a new backend: a storage outage now denies the admin probe instead of granting it, which is the intended fail-closed behaviour.

Rollback is a normal revert of the focused backend, portal and documentation commits. Do not weaken the server-side admin guards, merge login-history access into `users.read`, reintroduce an empty-success fallback for storage failures, or add synthetic user records as a rollback shortcut.

The standalone `AdminUserDetailService` is registered in `AdminModule` and verified by its spec, while `AdminService.getUser` remains the canonical single-user query provider for `AdminV1Controller`.
