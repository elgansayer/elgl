# GPS Nearby discovery

Issue: #821

## User flow

Nearby remains an explicit discovery filter. The app does **not** request browser location during bootstrap or ordinary discovery. Selecting **Nearby** requests the browser's current position, uses a 10 km starting radius, forces nearest-first ordering, and sends latitude/longitude as a pair to the existing `GET /discovery/partners` API.

A successful GPS fix is held in memory only. It is refreshed after five minutes and is cleared when discovery filters are reset or the component is destroyed. This flow does not write to the persisted/current-location or live-location-sharing features.

If the browser does not support geolocation, permission is denied, the lookup times out, the position is unavailable/invalid, or the client is offline, Nearby fails closed with a visible retry state. It never substitutes cached/mock partners for a GPS result.

## Distance and privacy contract

The server remains the source of truth for proximity distance. Nearby requests use `sort=nearest`; the client does not calculate partner-to-partner distance from coordinates.

The public discovery response may contain `distance_metres` but must not expose precise coordinate fields. `NearbySearchIntegrityInterceptor` strips coordinate-shaped response keys and rejects any spatial result set containing rows without a finite `distance_metres`. This prevents the discovery service's normal non-spatial degradation fallback from being presented as Nearby data.

Display distance is intentionally approximate:

- `en-US` uses feet below one mile and miles above it.
- Other supported locales use metres below one kilometre and kilometres above it.
- Short ranges and larger distances are rounded before rendering to avoid implying false precision.

The API accepts latitude/longitude only as a pair, validates coordinate bounds, and caps `radius_metres` at 250,000 metres. Existing blocked-user, search-visibility, deletion/moderation and VIP rules continue to run in the normal discovery service.

## Failure behaviour

| Failure | Behaviour |
| --- | --- |
| Browser has no geolocation API | Explain that Nearby cannot run and offer retry/navigation via existing filters. |
| Permission denied | Explain how to allow browser location, keep coordinates unset. |
| Timeout/unavailable/invalid position | Show a retryable location error; send no discovery request with bad coordinates. |
| Offline | Do not use offline cache or mock partners for Nearby. |
| PostGIS/degradation returns non-spatial rows | API returns 503 instead of unrelated partners. |
| Stale GPS fix (>5 minutes) | Request a fresh fix before the next Nearby search. |
| User leaves Nearby while permission prompt is open | Ignore the stale completion using a request generation token. |

## Verification

Frontend focused tests cover browser geolocation success, unsupported browsers, permission denied, position unavailable, timeout, invalid coordinates, and metric/imperial privacy rounding.

Backend tests cover coordinate-pair validation, the 250 km radius bound, allowed sort values, Nearby response fail-closed behaviour, and coordinate redaction.

Manual smoke test:

1. Open Discover. Confirm no location prompt appears on initial load.
2. Select Nearby and allow location. Confirm the request contains latitude, longitude, bounded radius and `sort=nearest`.
3. Confirm cards show one approximate unit system, not both km and miles.
4. Deny permission and confirm a visible location-specific retry state is shown without partner cards.
5. Switch offline and select Nearby. Confirm cached/mock users are not displayed as nearby.
6. Leave Nearby while the permission prompt is open. Confirm resolving the prompt does not replace the active non-Nearby results.
7. At 200%/400% browser zoom and a narrow mobile viewport, confirm the error/retry state wraps without horizontal clipping and is announced via `aria-live`.

## Observability and sensitive data

Do not log latitude/longitude values. The frontend logs only the generic partner-search failure object; the geolocation wrapper exposes categorical error codes. API validation/degradation errors contain no coordinates. Exact requester coordinates are query inputs only and should remain excluded from analytics payloads.

## Rollout and rollback

No database migration is required. Deploy backend and frontend together so the client and response-integrity contract agree.

Rollback is code-only: revert the GPS Nearby commits. There is no persisted location data or schema to clean up. If only the frontend must be rolled back, the backend validation/interceptor is safe to leave in place because it affects only `GET /discovery/partners` requests that supply GPS coordinates.
