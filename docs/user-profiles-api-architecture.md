# User Profiles API architecture

Issue: #2112

## Scope

The User Profiles domain is implemented by `backend/src/users/users.controller.ts`, `UsersService`, profile DTOs, `MediaService`, `SupabaseAuthGuard`, `TwoFactorGuard`, and the Supabase/PostgreSQL profile/social tables they access. The live NestJS Swagger UI remains available at `/api/docs`. The reviewable OpenAPI contract for this domain is `docs/api/user-profiles.openapi.json`.

The contract covers authenticated self-profile reads and writes, profile media upload preparation, profile visitors and status viewers, privacy and message-filter preferences, business-profile fields, notification preferences, profile discovery/search projections, followers/following, follow/unfollow, blocking, reporting, contact sharing, XP/stats/proficiency, data export, and account deletion/restoration.

## Request boundary

All routes are under `/api/users` because NestJS applies the global `/api` prefix and `UsersController` uses `@Controller('users')`. `SupabaseAuthGuard` is applied at controller scope. The Swagger contract therefore declares a global HTTP Bearer JWT security scheme named `bearer`; callers must use a Supabase-issued access token in the `Authorization` header.

The application-wide `ValidationPipe` uses `whitelist: true`, `transform: true`, and `forbidNonWhitelisted: true`. DTO-backed mutations must remain the source of truth for validation. Query-string primitives are validated explicitly by `UsersController`; the OpenAPI file documents the same externally relevant bounds.

Account deletion, permanent deletion, deletion restoration, and self-profile mutation retain the existing `TwoFactorGuard` policy where it is already enforced. Destructive deletion endpoints also retain their dedicated throttles. The OpenAPI contract marks these operations with `x-requires-2fa: true` so generated/internal documentation does not imply bearer authentication alone is sufficient.

## Data flow and ownership

Supabase/PostgreSQL is authoritative for profile state. `UsersService` owns persistence and policy decisions; frontend state, cached search results, Redis-derived data, and Swagger examples must never become authorization inputs.

Self-service mutations derive the subject user ID from `@CurrentUser()`. The browser cannot choose a different owner for self-profile, privacy, notification, export, deletion, visitor, or contact-sharing operations. Public/profile-targeted operations accept an explicit path ID only where the product requires another profile to be viewed or acted upon.

Profile media uses the existing media service to generate server-owned object keys and short-lived upload URLs. The API documentation exposes the `uploadUrl`, `mediaUrl`, and `objectKey` response contract but does not expose provider credentials or signing internals.

## Privacy and authorization invariants

The following rules are server-authoritative and must remain true even if a client is stale or malicious:

- `profile_visibility` is enforced before another user's profile is returned. Hidden profiles are not readable and VIP-only profiles require a verified VIP requester.
- Block relationships and report/contact-sharing policy are evaluated on the backend. Client-side filtering is defense in depth only.
- Visitor/status-viewer responses are privacy projections. Masked/blurred visitors must not expose identity fields through alternate response properties.
- Incognito visits, hidden age/location/gender/search preferences, last-seen/photo/about/status visibility, message filters, and Do Not Disturb settings are private user preferences. They must not be logged as metric dimensions or copied to shared caches.
- Contact sharing returns only fields explicitly authorized by `UsersService`; it is not a general profile-column read endpoint.
- Data exports are user-scoped private data. Downstream gateways and clients should treat them as `private, no-store` even when no shared cache is currently configured.
- Bearer tokens, presigned upload URLs, raw profile text, contact details, exported data, and provider/database errors must not appear in logs.

## Pagination and bounded collections

Follower and following endpoints accept `limit` and `offset`; the controller enforces a maximum limit of 100 and a default of 20. Search enforces the same maximum and defaults to 10. Offsets must be decimal integers between 0 and 10,000. Pagination values use strict decimal parsing; whitespace, fractional, exponential, negative, unsafe, and over-limit values fail with `400` before a Supabase query is issued. New collection endpoints in this domain must use explicit bounds rather than unbounded table scans.

Visitor/status-viewer endpoints currently return arrays from existing service methods. If those datasets grow beyond their present product constraints, pagination must be added compatibly before removing the current array response shape.

## Failure behavior

Authentication failures return `401`. Policy failures such as hidden/VIP-only profiles, relationship restrictions, or failed second-factor requirements return `401`/`403` according to the existing guard/service behavior. DTO or explicit input validation failures return `400`; throttled destructive operations return `429` and should preserve `Retry-After` when supplied by the throttler.

Datastore, media-provider, or downstream failures must fail closed. They must not fabricate profile state, visitor identities, contact details, upload URLs, export contents, VIP entitlements, or successful deletion state. Public errors should remain stable and sanitized while server logs use fixed event/error classifications without private content.

## OpenAPI maintenance contract

`docs/api/user-profiles.openapi.json` is intentionally checked in rather than generated from TypeScript alone because several current routes use inline response/request types that Swagger reflection cannot fully describe. Live Swagger still receives the `User Profiles` tag and Bearer security metadata through the users module; the checked-in contract supplies the richer architecture-level shapes and operational notes.

`backend/src/users/user-profiles.openapi.contract.spec.ts` protects the minimum contract by verifying:

- valid OpenAPI 3.1 JSON and the `/api` server prefix;
- the Bearer JWT scheme and global security requirement;
- coverage of every current `UsersController` route family;
- `User Profiles` tagging on every documented operation;
- explicit 2FA markers on destructive/self-profile protected operations;
- bounded follower/following/search parameters;
- success response codes aligned with the existing Nest controller behavior;
- privacy-sensitive schemas and sanitized failure responses;
- live Swagger tagging/security metadata remains attached to `UsersController`.

When a users route is added, removed, renamed, changes authentication, or changes a stable response/request shape, update the OpenAPI file and this architecture document in the same pull request.

## Accessibility and client UX

This backend/documentation change does not introduce a new visual surface. Consumers must continue to expose profile privacy, deletion, blocking/reporting, upload, and preference mutations with keyboard-operable controls, visible focus, semantic labels, non-colour-only state, screen-reader feedback for success/failure, and reflow at high zoom. Permanent deletion requires explicit consequence text and confirmation in the UI; API documentation is not a substitute for that user-facing confirmation.

## Observability

Useful operational signals are aggregate counts/rates for profile update failures, authorization denials by stable reason class, media-presign failures, export failures, deletion/restore failures, throttling, and datastore latency. Do not use user IDs, profile text, contact details, URLs containing credentials, tokens, or visitor identities as metric labels.

A request/correlation ID may be used where the existing request pipeline supports it, provided it cannot be used to reconstruct private profile data.

## Rollout and rollback

There is no schema migration or data backfill. Deploy normally with the backend. Valid existing clients are unchanged; invalid, fractional, negative, or over-limit pagination values now fail with `400` instead of reaching Supabase.

Rollback is a normal code/documentation revert. No user data, Supabase rows, Redis keys, or media objects require cleanup. If runtime behavior and this document diverge during a future rollback, runtime authorization remains authoritative and the OpenAPI contract must be corrected before the next release.

## Verification

Run the focused backend contract test and the normal backend verification suite:

```bash
cd backend
npm test -- src/users/user-profiles.openapi.contract.spec.ts src/users/users.controller.pagination.spec.ts
npm run build
npm run lint:check
```

Repository CI remains authoritative for full integration, database, frontend, E2E, dependency, and governance checks.
