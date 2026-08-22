# Admin user management

The Angular admin user-management surface is exposed at `/admin/users` and is protected by the frontend `adminGuard`. The backend remains the authoritative security boundary: every `/admin/**` request is authenticated by `SupabaseAuthGuard` and `AdminGuard`, and individual user-management routes additionally require the capability appropriate to the operation (`users.read`, `users.manage`, `users.sessions.read`, or `moderation.cases.manage`).

## Data and failure behaviour

Administrative reads must fail closed. The client must never substitute demo, cached, synthetic, or placeholder user/session data when the authenticated admin API is unreachable or rejects a request. A failed user-list request renders an unavailable state with an explicit retry action. A failed login-history request is likewise shown as unavailable rather than being presented as a real empty history.

This distinction is security-relevant because login history contains IP-address and user-agent data and because fabricated user records could cause an administrator to make a privileged decision against the wrong apparent account. Global block-list reads follow the same fail-closed rule.

The user list remains bounded by server-side pagination. Login history remains bounded by the backend contract. No new persistence, schema, cache, credential, or telemetry data is introduced by this change.

## Privileged mutations

VIP changes, warnings, bans, and block removal are sent only to authenticated backend endpoints. Mutation failures propagate to the UI and must not be converted into fake success. Server-side capability guards are authoritative even when a frontend route has already passed `adminGuard`.

## Verification

Automated coverage verifies that:

- user listing includes authentication plus search/pagination parameters;
- network failures and HTTP authorization failures reject instead of returning mock users;
- sensitive login-history failures reject instead of returning mock sessions;
- global block-list failures reject instead of becoming an apparently empty list;
- the routed admin user component renders retryable user-list and login-history failure states;
- a genuine empty result remains distinct from an unavailable result.

The standard repository CI remains the integration gate for frontend unit tests, static analysis, production build, backend checks, database checks, and repository governance.

## Rollout and rollback

No database migration or API-contract change is required. Deploy the frontend normally with the backend at its existing `/admin` contract. During rollout, a backend outage or authorization failure will become visible to administrators instead of silently rendering synthetic data.

Rollback is a normal revert of this change. There is no persisted state to reverse. Reintroducing the previous mock fallback is not recommended because it weakens the privileged trust boundary; if temporary offline admin operation is ever required, it should use an explicitly designed, encrypted, provenance-labelled, read-only cache rather than synthetic records.
