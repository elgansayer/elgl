# Discovery Nearby GPS contract

Issue #1271 is implemented by the existing Discovery `Nearby` mode and browser geolocation boundary. This document records the production contract so the behavior can be verified and changed safely.

## Product behavior

Nearby is opt-in. Ordinary Discovery startup and ordinary filters must not request browser location permission. Selecting **Nearby** requests a browser position and, only after a valid position is returned, queries Discovery with latitude, longitude, a bounded 10 km radius, and `sort=nearest`.

Nearby results must contain a finite server-computed `distance_metres` value. A location request must never silently degrade into an unrelated global result set if the spatial backend cannot provide distance data.

The UI displays an approximate human-readable distance rather than coordinates. UK and US English locales use miles (or feet below one mile); other locales use kilometres (or metres below one kilometre). Display values are privacy-rounded rather than presenting false precision.

## Privacy and failure behavior

Precise browser coordinates are ephemeral component state. They are cleared when the learner leaves Nearby and are never written to local storage by the geolocation service.

Nearby does not prompt while offline. Unsupported geolocation, permission denial, unavailable position, timeout, or stale coordinates produce an explicit retryable state instead of falling back to global Discovery results. Coordinates older than five minutes are treated as stale and require an explicit refresh.

Browser geolocation uses a bounded 10 second timeout and does not request high-accuracy mode. Returned coordinates are validated as finite latitude/longitude values in valid geographic ranges before they reach Discovery.

## API and data boundary

The browser supplies only the current latitude/longitude pair and search radius to the existing authenticated Discovery query. Distance calculation remains server-side/PostGIS-owned. Partner cards consume only the returned `distance_metres`; exact coordinates are not rendered into the DOM.

No schema migration is required for this contract. Existing profile-location retention, privacy controls, and backend authorization remain authoritative.

## Accessibility and localisation

Location requesting, unavailable states, loading, empty results, and result counts use the existing translated status/alert surfaces. Distance text is supplemental text, not colour-only state. Number formatting is locale-aware through `Intl.NumberFormat`.

The existing Discovery grid, keyboard navigation, touch targets, RTL-safe layout and high-zoom behavior remain unchanged by this contract.

## Verification

Focused checks:

```bash
cd frontend
npm test -- --run src/app/services/browser-geolocation.service.spec.ts src/app/components/discovery/discovery-nearby.spec.ts src/app/components/discovery/discovery-nearby-contract.spec.ts
npm run static-analysis
npm run build
```

The contract tests verify that location permission is user-triggered, the nearest query is bounded, miles/kilometres are mutually exclusive for a rendered value, and exact coordinates stop being sent after leaving Nearby.

Repository CI remains authoritative for the full frontend unit suite, build/static-analysis gates, design/accessibility governance, and end-to-end contracts.

## Rollout and rollback

This change adds verification/documentation only; it does not change the production API or schema. Rollback is a normal revert of the contract test/documentation. Any future behavioral rollback must preserve the privacy requirements: no background location prompt, no persistent precise browser coordinates, and no silent global-search fallback when Nearby cannot run.
