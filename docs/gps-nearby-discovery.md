# GPS Nearby discovery

Issue #821 makes the existing PostGIS proximity search reachable from the Angular Discovery screen without turning browser location into a background permission or persistence mechanism.

## User flow

Nearby is opt-in. Loading Discovery, ordinary filtering, and application startup do not call the browser geolocation API. Selecting the **Nearby** pill is the explicit user gesture that requests a current position. A successful request keeps the latitude/longitude pair in component memory only, switches the search radius to 10 km, selects `nearest`, and sends the pair to the existing authenticated `GET /discovery/partners` endpoint.

Coordinates expire after five minutes. A stale location is discarded and the UI requires an explicit retry before another browser location request. Leaving Nearby, resetting filters, or destroying the component also discards the in-memory coordinates.

## Failure behaviour

The browser boundary normalises geolocation failures to `unsupported`, `permission_denied`, `position_unavailable`, or `timeout` without retaining or logging the browser's error message. Offline Nearby never asks for location and never serves cached/mock users as if they were geographically nearby. The Discovery screen exposes a retryable Nearby state for location failures and a distinct offline message.

If the existing discovery service returns fallback rows without a database-computed `distance_metres`, the Nearby UI drops those rows. This prevents an outage or an empty spatial result from silently turning into an unrelated global-origin search.

## API and bounds

The authenticated discovery contract already requires latitude and longitude as a pair; that validation landed independently on `main` while #821 was being implemented. Latitude remains bounded to -90..90 and longitude to -180..180. The Nearby UI only sends the existing product distance-control range, 10 to 250 km, starting at 10 km. The backend retains its broader general-discovery radius validator for compatibility with other clients.

The active `search_nearby_users` PostGIS RPC already:

- uses `ST_DWithin` for radius filtering;
- computes distance in the database and orders by that distance ascending;
- limits results to 100;
- applies search-visibility and deletion filters;
- returns discovery-safe profile fields plus distance, not another user's raw location geometry or latitude/longitude.

No database migration is required for this change.

## Distance presentation

The client presents one unit system, not both. `en-GB` and `en-US` use miles/feet; other supported application locales use kilometres/metres. Distances are deliberately rounded (500 ft / 100 m at short range, half-mile / half-kilometre above that) so the UI does not imply precision beyond what is useful for discovery.

## Privacy and logging

Browser coordinates are transient client state. They are not written to local storage, IndexedDB, profile fields, analytics, or logs by this flow. Backend discovery responses do not expose raw candidate coordinates. Existing authentication, block, deletion, profile-visibility, and VIP-location-spoofing rules remain authoritative.

## Verification

Automated coverage includes browser success/unsupported/permission/unavailable/timeout handling, malformed coordinates, no startup prompt, explicit Nearby acquisition, bounded coordinate/radius/nearest query composition, offline handling, stale-coordinate handling, suppression of non-spatial fallback rows, and locale-specific single-unit formatting. The existing backend suite covers the paired-coordinate contract.

For manual verification:

1. Open Discovery and confirm no location permission prompt appears.
2. Select Nearby and grant location access; confirm the request includes latitude, longitude, a bounded radius, and `sort=nearest`.
3. Confirm result cards show a single rounded distance unit and no precise coordinates.
4. Deny location, retry, and test browser unsupported/timeout behaviour; the page must remain usable and must not show unrelated users as nearby.
5. Go offline and select Nearby; the existing offline state must be shown without a geolocation request.
6. At 200%+ zoom and a narrow mobile viewport, confirm the location state and retry action reflow and remain keyboard accessible.

## Rollout and rollback

Paired-coordinate backend validation is already present on `main`, so this change needs no backend or schema rollout beyond deploying the application normally. Ordinary non-spatial discovery remains compatible.

Rollback is a normal application revert. There is no migration or persisted GPS data to unwind, and no location data cleanup is required.
