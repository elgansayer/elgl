# Mock clock and time travel

Issue: #7934 (MB-007)

## Purpose

The mock backend exposes a deterministic clock for local, test and demo scenarios that need to cross expiry, reminder, streak, timezone or daylight-saving boundaries without waiting on wall-clock time.

This is test infrastructure only. The API is hidden with a 404 response unless the explicit `MOCK_BACKEND_MODE` boundary is enabled. Production and provision environments cannot enable mock mode, so production code must never treat this clock as a dependency fallback.

## Activation

Start the backend in an allowed mock profile, for example:

```bash
NODE_ENV=test MOCK_BACKEND_MODE=test npm --prefix backend run start
```

The clock starts at the deterministic fixture epoch `2024-01-01T00:00:00.000Z`.

## API

All routes are under `/api` when the normal global API prefix is active.

Read a namespace:

```text
GET /api/mock/clock?namespace=worker-a
```

Freeze it at an absolute instant and optionally select an IANA timezone:

```json
POST /api/mock/clock/freeze
{
  "namespace": "worker-a",
  "now": "2024-03-10T06:55:00Z",
  "timeZone": "America/New_York"
}
```

Advance or rewind by deterministic milliseconds:

```json
POST /api/mock/clock/advance
{ "namespace": "worker-a", "milliseconds": 600000 }
```

```json
POST /api/mock/clock/rewind
{ "namespace": "worker-a", "milliseconds": 600000 }
```

Reset a namespace to the fixture epoch:

```json
POST /api/mock/clock/reset
{ "namespace": "worker-a" }
```

Responses include the absolute UTC `now`, local wall-clock representation, IANA `timeZone`, current `utcOffsetMinutes`, deterministic fixture `epoch`, and `offsetMs` from that epoch. This makes DST transitions observable without relying on the machine's local timezone.

## Parallel safety

Each namespace owns independent clock state. Use a stable test-worker or scenario name such as `worker-3` so one parallel test cannot advance another worker's clock. Reset deletes only that namespace and reconstructs its exact epoch state.

Namespaces are limited to 64 letters, digits, dots, underscores and hyphens. Each advance/rewind operation is bounded to ten years to reject accidental runaway values.

## Determinism and scenarios

Use the mock clock for scenario-relative time while continuing to use `DeterministicFixtureGenerator` for deterministic IDs, ordering and pseudo-random values. A scenario should record both its fixture seed and clock namespace in failure diagnostics so it can be replayed exactly.

The clock accepts timestamps only when they include an explicit UTC offset. For timezone/DST tests, freeze the clock at an absolute instant with an IANA timezone, then advance across the transition. For example, `America/New_York` changes from UTC-05:00 to UTC-04:00 during the March 2024 transition while the absolute clock advances continuously.

## Security and privacy

- The clock contains no user data, credentials or production identifiers.
- Do not expose it from production/demo URLs unless the explicit offline mock profile is active.
- Do not log request bodies from scenario APIs if future mock scenarios add user-shaped fixture data.
- Do not make real services consult this clock as a production fallback.

## Verification

Run the focused backend contract:

```bash
npm --prefix backend test -- --runInBand src/app.controller.spec.ts
npm --prefix backend run lint:check
npm --prefix backend run build
```

The tests cover reset/replay, isolated namespaces, freeze/advance/rewind behavior, the US daylight-saving transition, invalid input, and the production-disabled boundary.

## Rollback

Rollback is code-only. Remove the clock routes and state helpers together. No schema or persisted data exists. Any mock scenarios that begin depending on the clock must first be updated to stop using its API before the clock is removed.
