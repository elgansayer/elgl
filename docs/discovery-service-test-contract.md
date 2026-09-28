# DiscoveryService regression test contract

This document records the focused regression coverage added for issue #1404. The main `backend/src/discovery/discovery.service.spec.ts` suite already exercises the broad DiscoveryService feature surface; the supplementary `discovery.service.regression.spec.ts` suite locks failure and trust-boundary behavior that was not explicit in that broad suite.

## Covered contracts

### Partner of the Week cache

- Redis cache payloads are treated as untrusted and only string user IDs are accepted.
- A failed candidate query must remove the previous `partner_of_week_ids` value rather than leave a stale weekly recommendation visible.
- An empty or defensively rejected candidate set must also remove the stale cache.
- Failure to remove a stale Redis value is logged and contained; the scheduled calculation must not crash the worker process.

### Proximity search selection

- PostGIS `search_nearby_users` is used only when both latitude and longitude are present.
- A request containing only one coordinate stays on the bounded standard discovery query instead of constructing a malformed proximity RPC request.
- Standard discovery remains available when optional Partner of the Week Redis enrichment is unavailable; users are returned without a weekly badge rather than failing the entire search.

## Security and privacy

The tests intentionally verify defense in depth around hidden/deletion-sensitive recommendation candidates and malformed cached identifiers. No private profile content, coordinates, Redis payloads, tokens, or provider errors are added to production telemetry by this test-only change.

The tests use isolated in-memory mocks and do not contact Supabase, Redis, Centrifugo, LiveKit, or any external provider.

## Verification

The backend Vitest runner discovers both `discovery.service.spec.ts` and `discovery.service.regression.spec.ts`. Repository CI remains the authoritative full-suite check. The focused suite is expected to pass without schema, API, or runtime changes.

## Rollout and rollback

This is test/documentation-only. There is no database migration, persisted-state change, API rollout ordering, or mixed-version concern. Rollback is a normal revert of the regression spec and this document; production behavior is unchanged.
