# Trust & Safety Load Tests (Artillery)

## Purpose

Validate the production readiness of every Trust & Safety endpoint in the
**Safety** and **Moderation** modules under realistic and peak traffic.

## Quick start

```bash
# 1. Start the backend (separate terminal)
npm run start:dev

# 2. Export the required environment variables
export TARGET_URL=http://localhost:3000
export AUTH_TOKEN="<valid-supabase-jwt>"
export TEST_USER_ID="<uuid-of-test-user>"

# 3. Run the load test
npm run load-test:trust-safety
```

If you don't have Artillery installed globally, use `npx`:

```bash
npx artillery run load-tests/trust-safety.yml
```

## Scenarios exercised

| Scenario              | Endpoints                                                                         |
| --------------------- | --------------------------------------------------------------------------------- |
| Safety read flows     | `GET /safety/report-categories`, `/blocked-ids`, `/is-blocked/:id`, `/blocked-and-blocker-ids/:id` |
| Block & unblock flows | `POST /safety/block`, `POST /safety/unblock`                                      |
| Report user flows     | `POST /safety/report`                                                             |
| Moderation flows      | `GET /moderation/items`, `GET /moderation/analyse/:id`                            |

## Phases

1. **Warmup** (30 s @ 2 req/s) – populate caches, let auto-scaler wake.
2. **Peak**   (60 s @ 10 req/s) – sustained production load.
3. **Spike**  (30 s @ 25 req/s) – burst pattern (e.g. coordinated abuse wave).

## Thresholds

- `p95` latency < 1 000 ms
- `p99` latency < 2 000 ms
- Zero `5xx` responses

The test will **fail** if any threshold is breached.

## Authentication

All endpoints are guarded by `SupabaseAuthGuard`.  You **must** provide a
valid JWT via `AUTH_TOKEN`.  Without it every request will return 401.