# Centrifugo Redis server contract

Issue #1316 asks for the Centrifugo server configuration and Redis-backed pub/sub path. The repository already contained the Centrifugo v5 configuration and Compose services; this change makes the deployment boundary explicit, removes production reliance on checked-in development credentials, and adds an automated drift guard.

## Runtime topology

Both production and development Compose stacks retain the same realtime dependency graph:

```text
Redis 7 (`cache`)
  |
  v
Centrifugo v5 (`websocket`)
  |
  +--> WebSocket clients
  |
  +<-- NestJS publish API
```

`config/centrifugo/config.json` selects the Redis engine and points it at `redis://cache:6379`. The `centrifugo` Redis prefix isolates Centrifugo keys from unrelated application cache data. Redis append-only persistence and health checks remain owned by the Compose `cache` service.

## Credentials and origins

The checked-in Centrifugo file contains development placeholders only. They must never be treated as production secrets.

Production `docker-compose.yml` maps the application deployment variables into the Centrifugo v5 environment-variable names:

- `CENTRIFUGO_SECRET` -> `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY`
- `CENTRIFUGO_API_KEY` -> `CENTRIFUGO_API_KEY`
- `FRONTEND_URL` -> `CENTRIFUGO_ALLOWED_ORIGINS`

All three source variables are required by the production Compose interpolation. This keeps the JWT signing secret shared by NestJS and Centrifugo without duplicating credentials, keeps the server API key out of Git, and prevents production from inheriting the wildcard development origin from the checked-in config.

Centrifugo configuration files have lower priority than environment variables, so deployment values override the development placeholders. Credentials belong in the deployment secret store and must not be logged, committed, returned to clients, or exposed in diagnostics.

## Failure behaviour

A missing production Centrifugo signing secret, API key, or frontend origin is a deployment configuration error and Compose must fail before starting the websocket service. This is preferable to launching with the repository placeholders or wildcard origin.

If Redis is unavailable, Centrifugo cannot provide the configured Redis-backed broker/history/presence behavior. The Compose health checks expose Redis and Centrifugo readiness independently so orchestration and monitoring can diagnose the failing dependency instead of representing the realtime path as healthy.

The NestJS application already validates its Centrifugo API/signing credentials in production. The server and backend must use the same signing secret so connection JWTs minted by NestJS validate at Centrifugo.

## Verification

Run the focused contract with:

```bash
node --test scripts/verify-centrifugo-redis.test.mjs
```

The `Centrifugo Redis Contract` GitHub Actions workflow runs the same check on pull requests, pushes to `main`/`develop`, and merge-queue validation. It verifies that:

- Centrifugo remains pinned to the v5 image in both Compose stacks;
- both stacks mount `config/centrifugo/config.json` and depend on Redis;
- the config continues selecting the Redis engine at `redis://cache:6379`;
- Redis remains version 7 with persistence and a health check;
- production injects required signing/API credentials and a non-default origin through environment overrides;
- `.env.example` continues documenting the matching backend variables.

For a deployment smoke test, start Redis and Centrifugo with deployment secrets, wait for both health checks, mint an authenticated connection token through NestJS, connect a client, and publish a test event through the backend. Repeat with a second Centrifugo node pointed at the same Redis instance when validating horizontal pub/sub behavior.

## Rollout and rollback

No database migration or persisted application-data change is required. Before deploying this change, ensure production supplies `CENTRIFUGO_SECRET`, `CENTRIFUGO_API_KEY`, and `FRONTEND_URL`.

Rollback is a normal application/configuration revert. Do not roll back by restoring placeholder credentials in production. If a deployment must temporarily revert the Compose mapping, inject equivalent Centrifugo environment variables through the deployment platform instead.
