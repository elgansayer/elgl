# Network abuse investigation and temporary controls

This document describes the production network-abuse contract introduced for issues #3653 and #3654.

## Authorization

The dedicated admin API exposes network-security operations under `/api/admin/v1/security/network`. Every endpoint requires a valid Supabase session, the existing admin guard, and a dedicated capability:

- `security.network.read` permits bounded reputation lookups, impact previews and active-control reads.
- `security.network.manage` permits creation and revocation of temporary blocks and allowlist exceptions.

Only `super_admin` receives these capabilities by default. Other roles must be granted them deliberately through the existing RBAC workflow. Hiding the admin-portal navigation is never treated as authorization.

The same capabilities protect ASN / hosting-provider routes under `/api/admin/v1/security/network/provider`. Every provider reputation read, impact preview, list operation and mutation is written through `AdminAuditService`.

## Privacy boundary

An IP reputation lookup accepts a public IP in a POST body rather than a query string. The API does not write the lookup IP to the admin audit log, application logs, Redis keys or a new persistence table. Redis enforcement caches use a truncated SHA-256 digest and expire after 30 seconds.

The IP response deliberately exposes only coarse internal signals: a `/24` IPv4 or `/64` IPv6 network, login-event counts, distinct-account count, coarse risk level, active controls and whether an allowlist exception applies. It does not expose unrestricted login-history rows, user agents or account identifiers.

ASN trend storage is even coarser. `admin_network_provider_daily_signals` stores one aggregate row per day, ASN and enforcement scope. It contains only the ASN, an optional edge-supplied provider label, a hosting-provider flag, aggregate request count and latest observation time. It never stores the source IP, user ID, session ID, request URL, request body or user agent. Provider signal rows are eligible for deletion after 90 days.

The only long-lived network identifiers persisted by the control system are CIDRs or ASNs that an authorized operator explicitly creates as a block or allowlist exception. Expired/revoked control records are eligible for deletion after 180 days to retain a bounded audit-supporting history.

## IP safeguards

Operator-created IPv4 networks are limited to `/24` through `/32`; IPv6 networks are limited to `/64` through `/128`. Private, loopback, link-local, multicast and other non-public addresses are rejected before database access. This prevents accidentally blocking broad internal or proxy ranges.

Blocks are always temporary and must expire between five minutes and 30 days from creation. Operators choose one of three scopes:

- `auth`: authentication endpoints, including signup/login traffic;
- `write`: application mutations such as posting and messaging while reads remain available;
- `all`: all non-admin application requests.

The admin API and documentation endpoints are exempt from enforcement so an operator cannot lock themselves out of the recovery surface. Allowlist entries override matching blocks. The portal requires a successful impact preview before it enables a block action.

Every lookup, impact preview, list operation, block mutation and allowlist mutation is audited. Raw lookup IP addresses are intentionally omitted from audit targets and metadata. Mutations retain the existing reviewed reason-code/operator-note contract.

## ASN and hosting-provider trends

`NetworkAbuseGuard` can consume trusted edge metadata for the current request:

- `X-ELGL-Client-ASN`: integer ASN from 1 through 4294967295;
- `X-ELGL-Client-Provider`: optional provider/organization label, sanitized and limited to 120 characters;
- `X-ELGL-Client-Hosting`: optional exact value `true` when vetted edge intelligence classifies the ASN as hosting infrastructure.

Only `auth` and `write` requests are added to the daily aggregate. Read-only traffic is deliberately excluded to bound write volume and keep the signal aligned with signup/posting abuse. Aggregate write failures never fail a user request.

Provider reputation combines seven-day activity, active days, hosting classification and active controls into coarse low/medium/high risk. The admin portal shows these trends and requires a 30-day impact preview before enabling a temporary ASN restriction. An ASN allowlist exception overrides a matching ASN block.

ASN controls use the same 5-minute minimum, 30-day maximum and `auth` / `write` / `all` scopes as CIDR controls. Mutations are idempotent per actor and idempotency key. Active decisions are cached for at most 30 seconds and share the same invalidation epoch as CIDR controls.

## Trusted edge metadata

By default the guard uses Express's direct remote address and ignores forwarded client-IP and provider metadata headers. `TRUST_CLOUDFLARE_CONNECTING_IP=true` remains supported only when the backend origin is firewalled so requests can arrive only through Cloudflare.

ASN/provider metadata has an additional switch: `TRUST_CLOUDFLARE_NETWORK_METADATA=true`. It has no effect unless `TRUST_CLOUDFLARE_CONNECTING_IP=true` is also enabled. Both switches must remain false on a publicly reachable origin.

Before enabling provider metadata, configure Cloudflare to **overwrite**, never preserve, the ELGL metadata headers. `X-ELGL-Client-ASN` can be populated from Cloudflare's `ip.src.asnum` field using a Transform Rule or Worker. `X-ELGL-Client-Provider` and `X-ELGL-Client-Hosting` are optional and must come from vetted edge-side intelligence if used. The API performs no outbound IP-to-ASN lookup, so raw client IPs are never sent to a third-party enrichment service by this feature.

If trusted ASN metadata is missing or malformed, CIDR enforcement continues normally and provider enforcement is skipped. This mixed-version behavior allows the application revision and edge configuration to be deployed independently without blocking legitimate users.

## Enforcement and failure handling

`NetworkAbuseGuard` is registered as a Nest global guard. It asks PostgreSQL whether the current public client IP or trusted ASN matches a live block and caches boolean decisions for at most 30 seconds. The IP and ASN checks run in parallel.

If Redis is unavailable, PostgreSQL remains authoritative. If an IP or ASN enforcement lookup itself fails, that specific lookup fails open and emits a structured error without the raw IP or provider label. This preserves availability during database incidents rather than turning the abuse-control subsystem into a global outage switch. A still-functioning IP control can continue blocking even when the ASN lookup fails, and vice versa.

Daily ASN signal aggregation is best effort: write failures emit a structured warning containing only ASN, scope and error type. They do not affect request authorization. Control mutations and admin investigation endpoints fail normally on database errors so an operator is never told a rule was stored when it was not.

## Database boundary

The provider migration creates three RLS-enabled tables with direct `anon` and `authenticated` access revoked:

- `admin_network_provider_daily_signals` for 90-day privacy-minimized aggregates;
- `admin_network_provider_blocks` for temporary ASN restrictions;
- `admin_network_provider_allowlist` for explicit exceptions.

`record_network_provider_signal`, `is_network_provider_request_blocked`, `admin_network_provider_reputation`, `admin_network_provider_block_impact` and `prune_admin_network_provider_controls` are service-role-only functions. Browser clients cannot forge aggregate signals or query control state directly through Supabase.

## Deployment

1. Apply `20260823130000_admin_network_abuse_controls.sql` and `20260824165000_admin_network_provider_controls.sql` before deploying the application revision.
2. Verify the intended admin roles have `security.network.read` and `security.network.manage`.
3. Keep `TRUST_CLOUDFLARE_CONNECTING_IP=false` and `TRUST_CLOUDFLARE_NETWORK_METADATA=false` unless the backend origin is Cloudflare-only.
4. If enabling ASN metadata, configure an edge rule that overwrites `X-ELGL-Client-ASN` from trusted Cloudflare request metadata. Only add provider/hosting headers when backed by a vetted edge-side data source. Verify direct-origin access is impossible before flipping the switches.
5. Exercise the admin portal Network Security page with a known public test address and ASN. Confirm both CIDR and provider impact previews load before applying short-lived test rules.
6. Verify allowlist exceptions override matching CIDR/ASN blocks and that revocation becomes effective within the 30-second decision-cache window.
7. Confirm `admin_network_provider_daily_signals` receives only aggregate `auth`/`write` rows and contains no user or IP columns.
8. Schedule `select public.prune_admin_network_controls();` and `select public.prune_admin_network_provider_controls();` at least daily using the existing database maintenance scheduler.

## Rollback

The migrations are additive. Roll back the application first; with the old application revision, provider headers and provider tables are simply unused while existing CIDR behavior remains intact.

Before a prolonged rollback, revoke any still-active provider restrictions through the admin API or a service-role maintenance session. Do not drop the tables during an incident because they contain bounded audit-supporting history. Provider signal rows can safely age out under the 90-day pruning policy.

To disable ASN/provider enforcement without rolling back the application, set `TRUST_CLOUDFLARE_NETWORK_METADATA=false`. CIDR enforcement remains active. To disable all proxy-derived metadata, also set `TRUST_CLOUDFLARE_CONNECTING_IP=false` and the guard falls back to the direct Express remote address.

## Verification

Focused backend tests cover public-network/CIDR safeguards, ASN bounds, provider-label sanitization, trusted-header gating, auth/write trend aggregation, provider decision caching, cached authorization decisions, fail-open enforcement storage behavior and invalid metadata rejection. Admin portal code uses the same capability-gated Network Security surface for provider reputation, impact previews, temporary restrictions, exceptions and revocation.

Database reset/CI validates the additive migrations, RLS setup and service-role functions. Operational verification should additionally confirm that a request with forgeable client-supplied `X-ELGL-*` headers is ignored while metadata injected by the locked-down Cloudflare edge is honored.
