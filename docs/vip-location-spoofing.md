# VIP location spoofing

Issues #954 and #1741 are implemented by the canonical backend `DiscoveryService.searchPartners` path, with the stored-value decoding and the VIP decision owned by `backend/src/discovery/vip-location-spoof.policy.ts`. VIP location spoofing is a discovery-input override: it changes the location used to find candidate partners, but it does not change the member's real device location, authentication identity, block state, or any target user's visibility/privacy rules. It also does not change where other members see the VIP: candidate distances are still computed from each candidate's own stored `location`.

## Contract

For an authenticated user's discovery request:

1. The backend starts with the validated `latitude` and `longitude` supplied by the discovery request.
2. If the caller's server-loaded profile is VIP and `mock_location` decodes to a valid WGS84 point (see "Stored value formats"), the service replaces the search coordinates with that point.
3. A valid VIP mock point is sufficient to use the existing PostGIS `search_nearby_users` path even when the browser did not supply GPS coordinates.
4. If the profile is not VIP, `mock_location` is ignored and the request coordinates remain authoritative.
5. A VIP `mock_location` that cannot be used (unsupported format, non-finite or out-of-range ordinate, SRID other than 4326) is ignored and a sanitised warning is logged. The service falls back to the request coordinates when present, or to normal non-spatial discovery when no usable coordinates exist. An unusable value is never forwarded to the RPC, so it cannot push discovery into the PostGIS error fallback.
6. VIP `mock_country` and `mock_city` similarly override requested country/city filters. Non-VIP profiles cannot use those stored spoof values.
7. The separate `enable_location_spoofing` profile flag is not consulted by discovery. Spoofing is driven by VIP status plus a usable stored `mock_location`, as specified. The flag is not part of the migrated `users` schema, so gating discovery on it would need its own migration and product decision.

The implementation deliberately reads VIP entitlement and spoof values from the authenticated profile supplied by the backend controller/service boundary. The client cannot gain spoofing behaviour merely by sending an `is_vip` flag or arbitrary spoof fields in the discovery query.

## Stored value formats

`users.mock_location` is a `geography(Point, 4326)` column. The form in which a Supabase read hands that value back depends on the column type and PostGIS version, so the decoder does not assume one. `parseGeographyPoint` accepts these forms of a 2D point:

| Form | Example |
| --- | --- |
| GeoJSON `Point` | `{ "type": "Point", "coordinates": [139.6917, 35.6895] }` |
| WKT or EWKT text | `POINT(139.6917 35.6895)`, `SRID=4326;POINT(139.6917 35.6895)` |
| Hex encoded EWKB, either byte order, with or without an SRID | `0101000020E610000095D4096822766140C74B378941D84140` |

GeoJSON and WKT order is longitude then latitude. A value is rejected when any of these hold: the geometry is not a plain 2D point (Z, M, other geometry types, `POINT EMPTY`); an ordinate is not a finite number; latitude is outside -90..90 or longitude outside -180..180 (which also catches swapped coordinates); an SRID is present and is not 4326; or the text is longer than 128 characters. Numeric strings inside a GeoJSON `coordinates` array are not coerced.

The request-time check is defence in depth. Profile updates already validate `mock_location` at the API boundary, but values written by other paths (a manual fix, an import, a future writer) must not reach the privileged `search_nearby_users` function, which raises SQLSTATE `22023` on out-of-range input.

Profile updates validate both physical and mock coordinate values before they can be persisted: latitude is bounded to -90..90 and longitude to -180..180. This prevents a VIP profile from storing a syntactically numeric but geographically invalid origin that would later reach the PostGIS discovery path.

## Privacy and safety

Location spoofing changes only the origin used by discovery. Existing discovery safety boundaries remain in force, including:

- self exclusion;
- hidden-from-search filtering;
- blocked and blocker filtering;
- the normal PostGIS radius boundary;
- existing language, age, proficiency, audio-intro and other discovery filters;
- server-side VIP gating for VIP-only filters.

The service never logs spoofed coordinates, raw stored values or the profile. Discovery responses continue to expose only the normal result fields and computed distance behaviour; they do not disclose which origin was used for the search.

## Failure and fallback behaviour

If the PostGIS RPC fails or returns no usable rows, discovery follows the established bounded fallback path rather than weakening authorisation or privacy checks. An invalid stored point never causes the service to manufacture coordinates. Redis failures for Partner of the Week enrichment are non-fatal and do not change the spoofing decision.

No new persistence, background job, cache, or retention store is introduced by this feature. `mock_location`, `mock_country`, `mock_city`, and VIP entitlement remain owned by the existing user-profile lifecycle and account-deletion behaviour.

## Observability

When a VIP profile holds a `mock_location` that cannot be used, `searchPartners` logs one structured warning per request:

```json
{ "mockLocationType": "string" }
```

with the message `Ignoring unusable VIP mock_location; using request coordinates`. The only field is the JavaScript type of the stored value (`string` or `object`), which is enough to tell a decoder gap (an unexpected text form) from corrupt data without recording any location. `nestjs-pino` binds each line written during a request to that request's method and URL, so the warning can be matched to the `GET /discovery/partners` call that produced it. No user identifier is added: that keeps the line free of personal data and follows the other `DiscoveryService` log lines, and the realistic cause is a stored form the decoder does not yet understand, which is a code fix rather than a per-account data fix.

A VIP with no stored value, and any non-VIP profile, never produces this warning. A sustained rate of it means VIP spoofing is silently not applying for those members; investigate the stored form before changing the decoder. The existing `PostGIS partner search failed; using bounded non-spatial fallback` warning and the discovery degradation events remain the signals for RPC failures.

## Verification

Regression coverage lives in:

- `backend/src/discovery/vip-location-spoof.policy.spec.ts` for the decoder (GeoJSON, WKT/EWKT, EWKB in both byte orders with fixed known-good byte vectors), coordinate and SRID validation, hostile and malformed input, and the VIP decision;
- the focused `DiscoveryService` VIP-location suite for stored-origin-only discovery, real-coordinate override for every stored form, non-VIP isolation, client-supplied spoof attempts, unusable stored values with the sanitised warning, and country/city behaviour;
- `backend/src/discovery/discovery.service.postgis.spec.ts` for the existing PostGIS request contract and VIP coordinate override;
- `backend/src/users/dto/update-profile.coordinates.spec.ts` for physical and spoofed coordinate boundary validation at the profile-update API boundary.

Repository CI remains authoritative for backend tests, lint, build, E2E and database/governance gates.

## Rollout and rollback

There is no database migration or API response-shape change. Deploy as a normal backend change. Every stored form that previously worked (a GeoJSON `Point`) still works; additional PostGIS forms now work, and values that are out of range or malformed are now ignored with a warning instead of being forwarded to the RPC.

Rollback is a normal application revert of `vip-location-spoof.policy.ts` and its wiring in `searchPartners`, which restores the previous GeoJSON-only decoding. The runtime location-spoofing path already exists on `main`; removing that behaviour separately would be a product change and should be coordinated with clients that expose VIP location controls.

After deploying, a quick live-environment check is to give a VIP test member a stored spoof point in a distant city, call `GET /discovery/partners` with a different pair of coordinates, and confirm that the returned `distance_metres` values are measured from the stored point. If results ignore that point and the warning above is absent, the stored form is not reaching the service at all, which points at the profile read rather than the decoder.
