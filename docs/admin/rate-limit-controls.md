# Admin emergency rate-limit controls

Issue #3613 adds a bounded, reversible abuse-control layer to the existing admin network-security API. It is intentionally **additive only**: operators can temporarily make a network stricter, inspect the active policy, revoke a false-positive throttle, or use the existing hard-block revoke API. There is no endpoint that raises, disables, or bypasses the application's normal security limits.

## API and authorization

All endpoints live under `/admin/v1/security/network` and keep the existing Supabase admin authentication, admin-role guard, capability guard, and audit pipeline.

| Endpoint | Capability | Purpose |
| --- | --- | --- |
| `GET /rate-limits` | `security.network.read` | List up to 50 active emergency throttles. |
| `POST /rate-limits/inspect` | `security.network.read` | Inspect a public IP and request scope without placing the IP in a URL. |
| `POST /rate-limits` | `security.network.manage` | Create a temporary stricter throttle. |
| `DELETE /rate-limits/:id` | `security.network.manage` | Revoke a throttle immediately. |
| `DELETE /blocks/:id` | `security.network.manage` | Existing hard-block false-positive recovery path. |

Creation is bounded to 1–300 requests per 10–3600 second window, expires between 5 minutes and 24 hours after creation, requires an approved admin reason, and requires a UUID idempotency key. Repeated creation with the same operator/idempotency key returns the original control rather than creating duplicate state.

Scopes are deliberately small and match the global network guard:

- `auth`: authentication endpoints only;
- `write`: non-auth mutating requests;
- `all`: all non-exempt application traffic.

The admin API, documentation and health endpoints remain exempt so an emergency throttle cannot lock operators out of the recovery surface.

## Enforcement model

PostgreSQL is authoritative for active policy selection. `admin_network_rate_limit_for_ip(inet, text)` chooses the strictest active matching CIDR policy by request rate, then count, CIDR specificity and creation time. The RPC is `SECURITY DEFINER`, has a fixed search path, and is executable only by `service_role`.

The request guard uses a Redis fixed-window counter keyed by the control ID, a truncated SHA-256 digest of the public IP and the current window. Raw IP addresses are never placed in Redis keys. A policy-cache epoch makes create/revoke changes visible immediately without wildcard key scans; cached policies otherwise expire after 30 seconds.

A matching hard block is evaluated before the emergency throttle and remains a 403. An exceeded emergency throttle returns 429 with a bounded `Retry-After` header. Existing feature-specific rate-limit guards continue to run independently, so this layer cannot weaken a lower application limit.

## Privacy and audit

The persistence table stores operator-selected CIDRs because those are required for enforcement. It does not contain raw lookup IPs. Inspection accepts a raw IP only in the POST body and returns a coarse network identifier; audit metadata records the operation and outcome, not the submitted IP. Enforcement logs contain event type, scope and error class only.

Privileged reads and mutations use the existing admin audit service with actor, capability, outcome, correlation ID and target ID where a persisted control exists. Creation additionally records the approved reason and normalized operator note.

Expired or revoked throttle records are retained for 180 days through the existing `prune_admin_network_controls()` job, matching hard network-control retention. Browser roles have no direct table access.

## Failure handling

A PostgreSQL policy lookup failure or Redis counter failure does not turn this optional additive layer into a global outage. The emergency throttle fails open and emits a sanitized operational error; existing endpoint/domain rate limits, authentication, block controls and authorization remain active. This is intentionally different from a primary authorization guard because the new control only adds temporary restrictions.

Inspection remains available when Redis counters are degraded, but reports zero observed hits rather than inventing state. Creation/revocation remain fail-closed on database write errors and do not acknowledge a policy change that was not persisted.

## Rollout

1. Apply `20260825033000_admin_network_rate_limit_controls.sql` before deploying the backend.
2. Verify the table has RLS enabled and `anon`/`authenticated` privileges are revoked.
3. Verify the service-role RPC returns `{}` when no rule applies.
4. Create a short-lived test throttle against a controlled public test CIDR, inspect it, verify 429/`Retry-After`, then revoke it.
5. Confirm audit events contain operation/correlation metadata without raw test IPs.

Mixed-version deployment is safe: the migration is additive and old backends ignore the new table/RPC.

## Rollback and recovery

Before rolling the backend back, revoke active rows in `admin_network_rate_limits` so operators do not mistake persisted-but-unenforced policies for active controls. The additive table and RPC can remain deployed for rollback safety; removing them is unnecessary. If an accidental throttle affects legitimate users, `DELETE /admin/v1/security/network/rate-limits/:id` is the immediate recovery path. Hard-block false positives continue to use the existing block revoke endpoint.

## Verification

Focused regression coverage lives in:

- `backend/src/admin/admin-rate-limit-control.service.spec.ts`;
- `backend/src/admin/guards/network-abuse.guard.spec.ts`;
- `backend/src/database/migrations/20260825033000_admin_network_rate_limit_controls.spec.ts`.

Run the backend unit suite and a clean Supabase migration replay before release. The migration contract additionally locks the request bounds, active-policy query, service-role-only execution, RLS posture and 180-day retention behavior.
