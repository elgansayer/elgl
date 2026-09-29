# Composable mock scenario manifests

Issue: #7940 (MB-003)

## Purpose

Mock scenario manifests let local development and automated tests combine named deterministic fixture profiles without editing fixture source. They are available only when the explicit mock backend boundary is enabled. Production dependency failures never activate a scenario pack.

## Packs and dependency order

| Pack | Dependency | Purpose |
| --- | --- | --- |
| `baseline` | none | Standard deterministic user and linked-account fixtures. |
| `empty` | none | Empty user and linked-account collections. |
| `dense` | `baseline` | Higher-volume deterministic fixtures for pagination and load testing. |
| `degraded` | `baseline` | Marks the scenario for deterministic degraded-service fixtures. |
| `moderation-heavy` | `baseline` | Marks the scenario for moderation-heavy fixture generation. |

Dependencies are expanded automatically and returned in deterministic order. `empty` cannot be combined with packs that require populated user data. Unknown or incompatible pack names fail with an actionable validation error.

## CLI selection

Set the default pack selection with `MOCK_BACKEND_SCENARIOS`. The existing activation guard still requires an explicit local, test or demo mock profile:

```bash
NODE_ENV=development \
MOCK_BACKEND_MODE=demo \
MOCK_BACKEND_SCENARIOS=dense,degraded \
npm --prefix backend run start:dev
```

If `MOCK_BACKEND_SCENARIOS` is omitted, the default is `baseline`. Invalid configured packs fail backend startup when mock mode is enabled and the mock scenario service is constructed.

## API selection

All routes are under `/api/mock/scenarios` and return `404` when mock mode is disabled.

- `GET /api/mock/scenarios` lists manifests and the configured default.
- `GET /api/mock/scenarios/:namespace` reads the compiled selection for one worker namespace.
- `PUT /api/mock/scenarios/:namespace` with `{ "packs": ["dense", "degraded"] }` selects packs for that namespace.
- `DELETE /api/mock/scenarios/:namespace` restores the configured default.
- `GET /api/mock/scenarios/:namespace/fixtures` returns the deterministic fixture snapshot for the compiled selection.

Namespaces are isolated in memory so parallel test workers can select different scenarios without sharing mutable state. Names are limited to 64 characters using letters, numbers, dot, underscore and hyphen.

## Determinism and replay

Scenario data uses the existing `DeterministicFixtureGenerator` and `MOCK_BACKEND_SEED`. `baseline` contains 150 deterministic users, `dense` contains 450, and `empty` contains none. Re-reading the same namespace with the same seed returns byte-stable fixture content. Resetting a namespace removes its override and restores the configured default selection.

The `degraded` and `moderation-heavy` traits are part of the compiled manifest contract so subsequent endpoint-specific mock scenarios can consume them without adding feature-specific environment flags.

## Offline, privacy and production safety

Scenario payloads contain synthetic repository-generated records only. They do not fetch third-party media or providers and do not contain credentials, production identifiers or real user data. The controller calls the same `isMockBackendEnabled()` boundary used by the rest of the mock backend and deliberately responds as not found outside explicit mock profiles.

Do not use scenario manifests as a fallback for database, Redis, realtime, media, AI, payment or provider errors. An authoritative dependency failure remains a real failure.

## Verification

Run the focused tests with:

```bash
npm --prefix backend test -- --runInBand \
  src/mock/scenario-manifests.spec.ts \
  src/mock/mock-scenarios.service.spec.ts
npm --prefix backend run test:e2e -- --runInBand test/mock-scenarios.e2e-spec.ts
npm --prefix backend run lint:check
npm --prefix backend run build
node scripts/verify-mock-backend-boundary.mjs
```

The HTTP E2E test performs list, select, fixture-read and reset operations, verifies namespace isolation, validates bad inputs, and confirms the routes disappear when mock mode is disabled.

## Rollout and rollback

Roll out with `MOCK_BACKEND_SCENARIOS` unset first, which preserves the existing baseline fixture behaviour. Opt individual local or test environments into additional packs as their dependent fixtures are implemented.

Rollback by removing scenario selection from local/test configuration and reverting the module. Keep `MOCK_BACKEND_MODE` disabled or unset in production throughout rollback. No database migration or persisted production state is involved.
