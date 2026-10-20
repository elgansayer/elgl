# Discovery PostGIS unit contract

Issue #1402 tracks unit coverage for the `DiscoveryService` PostGIS proximity path. The runtime path already exists in `DiscoveryService.searchPartners`; this document records the behavior the focused unit suite protects.

## Contract

When both latitude and longitude are available, discovery calls the `search_nearby_users` Supabase RPC. The RPC receives the viewer ID, search origin, radius and supported discovery filters. If no radius is supplied at the service boundary, the service uses 50 km.

A valid VIP mock location uses GeoJSON Point ordering (`[longitude, latitude]`) and becomes the proximity origin. Non-VIP users continue to use the submitted coordinates.

Successful RPC results normalise the legacy `distance` field into `distance_metres`. Blocked users are removed again at the application boundary as defense in depth, even though database-side discovery policy is also expected to enforce visibility constraints.

The service does not call the proximity RPC with a partial coordinate pair. Request DTO validation normally rejects that input at the HTTP boundary; the unit contract also verifies the service itself does not manufacture a missing coordinate.

If the PostGIS RPC is unavailable or returns no results, the current mixed-version compatibility behavior is a bounded non-spatial query of at most 50 users. Those fallback rows do not expose stale distance metadata, so the caller cannot display an old distance as if it came from the failed proximity query.

## Verification

Run the focused suite from `backend/`:

```sh
npm test -- src/discovery/discovery.postgis.spec.ts
```

The ordinary backend unit, lint and build jobs continue to run in repository CI.

## Security and privacy

The tests use synthetic users and coordinates only. They verify that the authenticated viewer ID is passed as the exclusion ID and that blocked users cannot be reintroduced by a successful RPC response. No production location, profile, token or provider data is logged or persisted by this test suite.

## Rollout and rollback

This change is test/documentation only. It does not alter APIs, migrations, query semantics or persisted data, so no staged deployment is required. Roll back by reverting the focused test and this document together; doing so removes regression protection but does not change production behavior.
