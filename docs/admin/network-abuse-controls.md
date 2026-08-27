# Network abuse investigation and temporary controls

This document describes the production contract introduced for issue #3653.

## Authorization

The dedicated admin API exposes network-security operations under `/api/admin/v1/security/network`. Every endpoint requires a valid Supabase session, the existing admin guard, and a dedicated capability:

- `security.network.read` permits bounded reputation lookups, impact previews and active-control reads.
- `security.network.manage` permits creation and revocation of temporary blocks and allowlist exceptions.

Only `super_admin` receives the new capabilities in the migration. Other roles must be granted them deliberately through the existing RBAC workflow. Hiding the admin-portal navigation is never treated as authorization.

## Privacy boundary

A reputation lookup accepts a public IP in a POST body rather than a query string. The API does not write the lookup IP to the admin audit log, application logs, Redis keys or a new persistence table. Redis enforcement caches use a truncated SHA-256 digest and expire after 30 seconds.

The response deliberately exposes only coarse internal signals: a `/24` IPv4 or `/64` IPv6 network, login-event counts, distinct-account count, coarse risk level, active controls and whether an allowlist exception applies. It does not expose unrestricted login-history rows, user agents or account identifiers.

The only network identifiers persisted by this feature are CIDRs that an authorized operator explicitly creates as a block or allowlist exception. Expired/revoked block records are eligible for deletion after 180 days through `prune_admin_network_controls()`.

## Safeguards

Operator-created IPv4 networks are limited to `/24` through `/32`; IPv6 networks are limited to `/64` through `/128`. Private, loopback, link-local, multicast and other non-public addresses are rejected before database access. This prevents accidentally blocking broad internal or proxy ranges.

Blocks are always temporary and must expire between five minutes and 30 days from creation. Operators choose one of three scopes:

- `auth`: authentication endpoints plus write restrictions on those endpoints;
- `write`: application mutations while reads remain available;
- `all`: all non-admin application requests.

The admin API and documentation endpoints are exempt from enforcement so an operator cannot lock themselves out of the recovery surface. Allowlist entries override matching blocks. The portal requires a successful impact preview before it enables the block action.

Every lookup, impact preview, list operation, block mutation and allowlist mutation is written through `AdminAuditService`. Raw lookup IP addresses are intentionally omitted from audit targets and metadata. Mutations retain the existing reviewed reason-code/operator-note contract.

## Enforcement and proxy trust

`NetworkAbuseGuard` is registered as a Nest global guard. It asks PostgreSQL whether the current public client IP matches a live block and caches the boolean decision for at most 30 seconds. If Redis is unavailable, PostgreSQL remains authoritative. If the enforcement lookup itself fails, the guard fails open and emits a structured error without the IP address; this preserves availability during database incidents rather than turning the abuse-control subsystem into a global outage switch.

By default the guard uses Express's direct remote address and ignores forwarded client-IP headers. Set `TRUST_CLOUDFLARE_CONNECTING_IP=true` only when the backend origin is firewalled so requests can arrive only through Cloudflare. In that deployment mode the guard accepts `CF-Connecting-IP`. Enabling it on a publicly reachable origin would let clients forge their apparent IP and is unsupported.

## Deployment

1. Apply `20260823130000_admin_network_abuse_controls.sql` before deploying the application revision.
2. Verify the `super_admin` role has both new network capabilities.
3. Keep `TRUST_CLOUDFLARE_CONNECTING_IP=false` unless the backend origin is Cloudflare-only. If Cloudflare-only, enable it and verify with a known test request that the expected client IP is used.
4. Exercise the admin portal's Network Security page with a non-production public test address. Preview impact before creating a short-lived rule.
5. Verify an allowlist exception overrides a matching block and that revocation becomes effective within the 30-second decision-cache window.
6. Schedule `select public.prune_admin_network_controls();` at least daily using the existing database maintenance scheduler.

## Rollback

Application rollback is safe because the migration is additive. Roll back the application first, then revoke any still-active controls through the admin endpoint or by setting `revoked_at` with a service-role maintenance session. Do not drop the tables during an incident because they contain the audit-supporting history for previous controls.

If the new enforcement path must be disabled urgently, rolling back the application removes `NetworkAbuseGuard` while leaving control records intact for later investigation. The next deployment can resume enforcement without recreating operator rules that have not expired.

## Verification

Focused backend tests cover public-network/CIDR safeguards, non-identifying Redis cache keys, cached authorization decisions, persistence failure behavior and invalid/private lookup rejection. Admin-portal route coverage ensures the page is gated by `security.network.read`. Database reset/CI validates the additive migration, RLS setup and function creation.
