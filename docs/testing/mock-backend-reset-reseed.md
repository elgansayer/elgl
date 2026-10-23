# Mock backend reset, reseed, and snapshot restore

Issue: #7935 (MB-006)

## Purpose

The mock backend exposes deterministic state-management commands for local development, automated tests, Storybook-style harnesses, and offline demos. These commands never activate automatically and are unavailable unless the explicit mock backend boundary is enabled.

## API

All routes are mounted under the normal `/api` prefix:

- `GET /api/mock/fixtures?namespace=<name>` reads the current namespace snapshot.
- `POST /api/mock/fixtures/reset` rebuilds the namespace from its current seed.
- `POST /api/mock/fixtures/reseed` changes the namespace seed and rebuilds it.
- `POST /api/mock/fixtures/snapshot` captures the current namespace under a named checkpoint.
- `POST /api/mock/fixtures/restore` restores a named checkpoint byte-for-byte.

Namespaces and checkpoint names are limited to 1-64 letters, digits, dots, underscores, or hyphens. A missing namespace uses `default`. Reseed values use the same unsigned 32-bit validation as `MOCK_BACKEND_SEED`.

Example:

```bash
curl -s -X POST http://localhost:3000/api/mock/fixtures/reseed \
  -H 'content-type: application/json' \
  -d '{"namespace":"e2e-1","seed":4242}'

curl -s -X POST http://localhost:3000/api/mock/fixtures/snapshot \
  -H 'content-type: application/json' \
  -d '{"namespace":"e2e-1","checkpoint":"before-test"}'

curl -s -X POST http://localhost:3000/api/mock/fixtures/reset \
  -H 'content-type: application/json' \
  -d '{"namespace":"e2e-1"}'

curl -s -X POST http://localhost:3000/api/mock/fixtures/restore \
  -H 'content-type: application/json' \
  -d '{"namespace":"e2e-1","checkpoint":"before-test"}'
```

Mutation responses include the namespace, active seed and seed identifier plus deterministic record counts for users, linked accounts, and total records. This provides a compact completion summary for test diagnostics without requiring logs or external services.

## Idempotency and parallel workers

A reset always rebuilds from `buildMockFixtureSnapshot(seed)`. Repeating reset with the same namespace and seed therefore restores the exact same fixture payload and does not append duplicate rows. Reseeding the same namespace with the same seed is equally repeatable.

Each namespace owns independent state and named checkpoints. E2E workers should use stable worker-specific namespaces such as `e2e-0`, `e2e-1`, and `e2e-2`; resetting or reseeding one namespace does not mutate another worker's state. Named snapshots are in-memory and intentionally disappear when the backend process exits.

The Angular `MockFixturesService` consumes these commands for frontend integration and E2E harnesses. It fails before making an HTTP request when the loaded client configuration has `mockBackendMode=disabled`.

## Safety and privacy

The controller checks the existing `isMockBackendEnabled()` boundary before every fixture operation and returns 404 when mock mode is disabled. Enabled mock modes are already rejected in production/provision environments by startup validation. State remains in process memory, contains only repository-owned synthetic fixtures, and never reads production storage or credentials.

These controls are not a fallback. Database, Redis, realtime, media, AI, payment, or other production dependency failures must continue to surface as failures.

## Validation

Run the focused contracts with:

```bash
npm --prefix backend test -- --runInBand src/mock/mock-fixture-state.contract.spec.ts
npm --prefix frontend test -- --runInBand src/app/services/mock-fixtures.service.spec.ts
node --test scripts/verify-mock-backend-boundary.test.mjs
node scripts/verify-mock-backend-boundary.mjs
```

The backend contract verifies repeatable reset, duplicate prevention, namespace isolation, reseed, snapshot restore, input validation, record-count summaries, and the production-disabled boundary. The frontend integration test verifies the real reset/reseed/snapshot/restore URLs and the client-side fail-closed guard.

## Rollback

This is in-memory, code-only state. Remove the mock fixture routes and `MockFixturesService` together if the control surface is rolled back. Existing deterministic fixture generation remains valid independently; no database migration or persisted cleanup is required.
