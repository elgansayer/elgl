# VIP location spoofing

Issue #954 is implemented by the canonical backend `DiscoveryService.searchPartners` path. VIP location spoofing is a discovery-input override: it changes the location used to find candidate partners, but it does not change the member's real device location, authentication identity, block state, or any target user's visibility/privacy rules.

## Contract

For an authenticated user's discovery request:

1. The backend starts with the validated `latitude` and `longitude` supplied by the discovery request.
2. If the caller's server-loaded profile is VIP and `mock_location` is a GeoJSON-style `Point` with two numeric coordinates, the service replaces the search coordinates with that point. GeoJSON order is `[longitude, latitude]`.
3. A valid VIP mock point is sufficient to use the existing PostGIS `search_nearby_users` path even when the browser did not supply GPS coordinates.
4. If the profile is not VIP, `mock_location` is ignored and the request coordinates remain authoritative.
5. Malformed mock-location values are ignored. The service falls back to the request coordinates when present, or to normal non-spatial discovery when no usable coordinates exist.
6. VIP `mock_country` and `mock_city` similarly override requested country/city filters. Non-VIP profiles cannot use those stored spoof values.

The implementation deliberately reads VIP entitlement and spoof values from the authenticated profile supplied by the backend controller/service boundary. The client cannot gain spoofing behavior merely by sending an `is_vip` flag or arbitrary spoof fields in the discovery query.

Profile updates validate both physical and mock coordinate values before they can be persisted: latitude is bounded to -90..90 and longitude to -180..180. This prevents a VIP profile from storing a syntactically numeric but geographically invalid origin that would later reach the PostGIS discovery path.

## Privacy and safety

Location spoofing changes only the origin used by discovery. Existing discovery safety boundaries remain in force, including:

- self exclusion;
- hidden-from-search filtering;
- blocked and blocker filtering;
- the normal PostGIS radius boundary;
- existing language, age, proficiency, audio-intro and other discovery filters;
- server-side VIP gating for VIP-only filters.

The service does not log mock coordinates. Discovery responses continue to expose only the normal result fields and computed distance behavior; they do not disclose whether a caller used their physical or mock origin.

## Failure and fallback behavior

If the PostGIS RPC fails or returns no usable rows, discovery follows the established bounded fallback path rather than weakening authorization or privacy checks. An invalid mock location never causes the service to manufacture coordinates. Redis failures for Partner of the Week enrichment are non-fatal and do not change the spoofing decision.

No new persistence, background job, cache, or retention store is introduced by this feature. `mock_location`, `mock_country`, `mock_city`, and VIP entitlement remain owned by the existing user-profile lifecycle and account-deletion behavior.

## Verification

Regression coverage lives in:

- `backend/src/discovery/discovery.service.postgis.spec.ts` for the existing PostGIS request contract and VIP coordinate override;
- `backend/src/discovery/discovery.service.vip-location.spec.ts` for mock-only discovery, real-coordinate override, non-VIP isolation, malformed values, and country/city behavior;
- `backend/src/users/dto/update-profile.coordinates.spec.ts` for physical and spoofed coordinate boundary validation at the profile-update API boundary.

Repository CI remains authoritative for backend tests, lint, build, E2E and database/governance gates.

## Rollout and rollback

There is no database migration or API response-shape change. Deploy as a normal backend change. Existing valid stored coordinates remain compatible; future out-of-range profile updates are rejected by request validation.

Rollback is a normal application revert of the validation change. The runtime location-spoofing path already exists on `main`; removing that behavior separately would be a product change and should be coordinated with clients that expose VIP location controls.
