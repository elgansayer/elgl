# Offline mock backend activation boundary

Issue: #7932 (MB-002)

## Purpose

Mock fixtures are an explicit local/test/demo facility. They are never a dependency fallback. A failed database, Redis, media, realtime, AI, payment, or other production dependency must continue to surface as a real failure instead of returning fixture-backed success.

## Backend activation

The backend accepts these `MOCK_BACKEND_MODE` values:

| Value | Meaning |
| --- | --- |
| `disabled` | Default. Mock backend behavior is off. |
| `local` | Explicit local development profile. |
| `test` | Explicit automated-test profile. |
| `demo` | Explicit offline/demo profile. |

Fixture-enabled values are accepted only with `NODE_ENV=development` or `NODE_ENV=test`. `NODE_ENV=production` and `NODE_ENV=provision` refuse to start when an enabled mock mode is supplied. Unknown values also fail startup validation.

Example local demo launch:

```bash
NODE_ENV=development MOCK_BACKEND_MODE=demo npm --prefix backend run start:dev
```

Production configuration must either omit `MOCK_BACKEND_MODE` or set it to `disabled`.

## Deterministic fixture seed

The mock backend uses the named `elgl-offline-fixtures` seed and the versioned `mulberry32-v1` generator. The default seed is `7932`, preserving the existing fixture sequence. Override it only in an explicit local/test/demo profile with an unsigned 32-bit integer:

```bash
NODE_ENV=test MOCK_BACKEND_MODE=test MOCK_BACKEND_SEED=424242 npm --prefix backend test
```

The same seed produces byte-stable fixture snapshots. A different seed produces a different but valid dataset. Generator instances are independent, so test workers and scenario factories do not share mutable PRNG state. The fixture helper also provides deterministic UUID, timestamp, coordinate and counter primitives for follow-up mock scenarios.

When mock mode is enabled, backend startup logs include the numeric seed, seed identifier, generator version and fixed fixture epoch. The seed is deliberately numeric and non-secret; fixture diagnostics must never contain credentials or production identifiers. Backend tests can read the same information through `MOCK_FIXTURE_DIAGNOSTICS` or `getMockFixtureDiagnostics()`.

`buildMockFixtureSnapshot(seed)` is a pure reset boundary: each call returns fresh arrays and objects. Rebuilding with the same seed restores the exact initial scenario even if a previous consumer mutated its local snapshot.

## Globally diverse user population

Issue #7946 adds a deterministic user-population fixture at `GET /api/mock/users`. The route is excluded from Swagger, returns `404` unless the explicit mock backend profile is enabled, and sends `Cache-Control: private, no-store`.

Use `size=minimal`, `size=medium`, or `size=large` for 12, 96, or 512 fictional profiles. `namespace` accepts up to 64 letters, numbers, dots, underscores, or hyphens and creates an isolated deterministic seed for parallel workers. For example:

```bash
curl 'http://localhost:3000/api/mock/users?size=minimal&namespace=playwright-1'
```

The catalogue covers Japanese, English, Arabic, Hebrew, Korean, Hindi, Spanish, Portuguese, Turkish, Vietnamese, French, and Polish native-language profiles with reciprocal target-language pairs, ages, proficiency levels, time-zone-compatible locations, Unicode and RTL names, one deliberately missing display name, and one deliberately long display name. All identities and biography text are synthetic repository-owned fixtures. No avatar, audio, or other remote media URL is generated.

The population builder is stateless: rebuilding the same size and namespace produces the exact same IDs, timestamps, ordering, and values. A different namespace uses an independent deterministic seed, so parallel test workers cannot perturb each other's sequence. There is no persisted state to clean up; calling the endpoint again is the reset/reseed operation for this read-only scenario.

Frontend test harnesses should consume the HTTP contract through `MockUserPopulationService` rather than importing backend fixture objects. That client fails before network access when the compiled frontend environment is production.

Focused verification:

```bash
npm --prefix backend test -- --runInBand src/mock/global-user-population.spec.ts src/mock/mock-users.controller.spec.ts
npm --prefix frontend test -- --run src/app/services/mock-user-population.service.spec.ts
```

## Client activation and indicator

The normal client config explicitly carries `"mockBackendMode": "disabled"`. For offline/demo work, copy the repository-owned profile before starting the frontend:

```bash
cp frontend/public/assets/config.mock.json frontend/public/assets/config.json
```

The demo profile points at the local NestJS API and sets `environment=demo` plus `mockBackendMode=demo`. When that profile is loaded, the global network banner area displays a persistent `ELGL Offline Demo · demo` status indicator. A client config that tries to enable mock mode in a production-like environment fails closed to the non-mock fallback configuration.

Do not deploy `config.mock.json` as the active `config.json`.

## Offline and privacy guarantees

Mock scenarios must use repository-owned/local media and must not call third-party providers. Fixture data must not contain real user data, access tokens, provider credentials, production identifiers, or copied production payloads. All pseudo-random values must come from `DeterministicFixtureGenerator`; do not use `Math.random()` or wall-clock time in mock fixture factories. Stable counters and explicitly fixed timestamps may remain index-derived where their existing public fixture identifiers must stay compatible.

This boundary intentionally does not convert ordinary production service failures into fixtures. A feature that wants fixture data must first prove the explicit mock mode is enabled.

## CI enforcement

`.github/workflows/mock-backend-boundary.yml` runs without application dependencies. It executes the verifier tests and then scans production/deployment artifacts for attempts to set `MOCK_BACKEND_MODE` to `local`, `test`, or `demo`. It also verifies that the backend startup validator, client validator, and visible indicator remain wired.

Run locally with:

```bash
node --test scripts/verify-mock-backend-boundary.test.mjs
node scripts/verify-mock-backend-boundary.mjs
npm --prefix backend test -- --runInBand src/mock/deterministic-fixtures.spec.ts src/mock-data.spec.ts
```

The ordinary backend and frontend test suites additionally cover runtime validation and fail-closed client configuration. Discovery and recommendation paths consume `MOCK_USERS` only behind the explicit mock-mode boundary, so the frontend continues to exercise the same API shapes rather than importing test fixtures directly.

## Rollout

1. Merge the boundary before adding new fixture scenarios.
2. Keep production/deployment configuration at `disabled` or unset.
3. Opt local/test/demo environments in explicitly.
4. Confirm the client indicator is visible whenever fixture mode is active.
5. Record the startup `seedId` in test failure diagnostics so a scenario can be replayed exactly.
6. Add future scenario payloads behind the same boundary and build them from `DeterministicFixtureGenerator` rather than adding per-feature fallback flags.

## Rollback

Reverting this change removes the explicit activation profile and deterministic generator contract. Do not roll back only the startup refusal while leaving new fixture scenarios reachable. If rollback is necessary, disable/remove any dependent fixture scenario first, then revert the boundary and generator as one unit.
