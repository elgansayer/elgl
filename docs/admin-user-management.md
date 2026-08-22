# Admin user management

ELGL has a dedicated Angular application in `admin-portal/` for privileged operations. Its user-management flow is routed through `/users` and `/users/:id`, uses `AdminUsersService`, and calls the versioned `/admin/v1/users` API. The consumer Angular application also retains an authenticated `/admin/users` surface for legacy operational access. Both surfaces must treat the backend as the authoritative trust boundary.

The backend user-management routes are authenticated and capability-scoped. User listing and inspection require `users.read`; session history requires `users.sessions.read`; mutations use their corresponding management or moderation capability. Client-side route guards are a usability layer only and never replace server-side authorization.

## Data and failure behaviour

Administrative reads must fail closed. Neither Angular application may substitute demo, synthetic, placeholder, or provenance-free user/session data when the authenticated admin API is unreachable or rejects a request. The consumer admin route renders a retryable unavailable state for user-list failures. A failed login-history request is likewise shown as unavailable rather than being presented as a real empty history.

This distinction is security-relevant because login history contains sensitive operational evidence such as IP-address and user-agent data and because fabricated user records could cause an administrator to make a privileged decision against the wrong apparent account. Global block-list reads follow the same fail-closed rule.

The dedicated admin portal already uses bounded pagination and authenticated versioned API calls. User identifiers are encoded before they are placed in detail/session-history URLs. The user list and login history remain bounded by their backend contracts. No new persistence, schema, cache, credential, or telemetry data is introduced by this change.

## Privileged mutations

VIP changes, warnings, bans, and block removal in the consumer admin surface are sent only to authenticated backend endpoints. Mutation failures propagate to the UI and must not be converted into fake success. Server-side capability guards are authoritative even when a frontend route has already passed a local admin guard.

The dedicated admin portal intentionally separates user investigation from higher-impact moderation and role-management workflows. High-impact operations remain in their capability-specific portal routes rather than being duplicated into read-only user search.

## Verification

Automated coverage verifies that:

- the dedicated admin portal refuses user API access when no admin bearer token exists;
- dedicated-portal searches send the bearer token, bounded pagination, and a trimmed search query to `/admin/v1/users`;
- detail identifiers are URL-encoded before privileged requests;
- user-search authorization failures and sensitive login-history failures propagate instead of substituting data;
- the consumer admin route sends authentication plus search/pagination parameters;
- consumer user-list network and authorization failures reject instead of returning mock users;
- sensitive login-history failures reject instead of returning mock sessions;
- global block-list failures reject instead of becoming an apparently empty list;
- the consumer admin user component renders retryable user-list and login-history failure states;
- a genuine empty result remains distinct from an unavailable result.

The standard repository CI remains the integration gate for both Angular applications, frontend unit/static-analysis/build checks, backend checks, database checks, admin-portal unit/lint/build checks, and repository governance.

## Rollout and rollback

No database migration or backend API-contract change is required. Deploy both Angular applications normally with the existing admin APIs. During a backend outage or authorization failure, administrators will see explicit failure states instead of synthetic records.

Rollback is a normal revert of this change. There is no persisted state to reverse. Reintroducing synthetic privileged fallback data is not recommended because it weakens the trust boundary; if temporary offline admin operation is ever required, it should use an explicitly designed, encrypted, provenance-labelled, read-only cache rather than synthetic records.
