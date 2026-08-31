# Centrifugo server and Redis contract

Issue #1316 completes the existing Centrifugo v5 deployment contract instead of introducing another realtime stack.

## Runtime topology

All Docker Compose variants use the same internal service names:

- `cache` is Redis 7 and is reachable from containers at `redis://cache:6379`.
- `websocket` is Centrifugo v5 and is reachable from the NestJS API at `http://websocket:8000`.
- the NestJS API receives `REDIS_URL=redis://cache:6379` and `CENTRIFUGO_URL=http://websocket:8000` explicitly so host-oriented `.env` defaults such as `localhost` cannot leak into container-to-container traffic.
- Centrifugo continues to expose its Prometheus listener on the internal metrics endpoint scraped at `websocket:8001`.

`config/centrifugo/config.json` owns non-secret realtime structure: Redis engine settings, namespace history/presence limits, connection limits and Prometheus enablement. The `chat`, `room` and `user` namespaces remain bounded and presence-enabled.

## Credentials

Centrifugo signing and API credentials are deployment secrets, not configuration source.

The Compose services map the existing application variables into the Centrifugo v5 environment names:

- `CENTRIFUGO_SECRET` -> `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY`
- `CENTRIFUGO_API_KEY` -> `CENTRIFUGO_API_KEY`

The NestJS `CentrifugoService` consumes the same `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` values when minting client tokens and calling the Centrifugo HTTP API. Production startup rejects missing, blank, whitespace-padded and repository-known placeholder credentials through the global environment validator. Production Compose additionally requires both values during interpolation and waits for the validated API health check before starting Centrifugo.

Do not commit real signing keys, API keys, connection tokens or Redis credentials. They belong in the deployment secret store or runtime environment. The browser never needs either Centrifugo server credential.

The existing `allowed_origins` behavior is intentionally unchanged by #1316; tightening deployment-specific browser origins should be coordinated with the actual production domains rather than guessed in this infrastructure change.

## Failure behavior

- Missing, blank, whitespace-padded or repository-known placeholder Centrifugo credentials fail the application configuration/startup boundary.
- Production Compose does not start Centrifugo until the API has validated the shared credentials and become healthy, so a predictable signing secret is never exposed while the API is failing.
- An unavailable Centrifugo container fails its health check and prevents dependent application startup according to the Compose dependency policy.
- An unavailable Redis service prevents Centrifugo's Redis engine from becoming healthy. The NestJS connection-rate limiter retains its existing degradation behavior when its own Redis client is unavailable.
- No fallback realtime provider or fabricated connection success is introduced.

## Verification

Run the focused contract locally with Node 22:

```bash
node --test scripts/centrifugo-config-contract.test.mjs
```

The contract verifies:

- Redis engine/service addressing;
- bounded `chat`, `room` and `user` namespaces;
- absence of tracked Centrifugo server secrets;
- backend and websocket service-DNS wiring in development, default and production Compose files;
- shared credential injection;
- example environment ownership; and
- Prometheus metrics scraping.

For a deployment smoke test, provide non-placeholder `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY`, start the production stack, verify that the API becomes healthy before `websocket`, then verify that a minted connection token can establish an authenticated client connection.

## Rollout and rollback

No database migration or persisted-data transformation is required.

1. Provision non-placeholder `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` in the deployment secret store.
2. Deploy Redis and the NestJS API so the shared credentials pass startup validation.
3. Allow Compose to start Centrifugo after the API health check succeeds.
4. Verify Centrifugo health, Prometheus metrics, token minting and an authenticated subscription.

Rollback is a normal application/Compose revert. Do not restore real credentials to the tracked JSON configuration during rollback; keep secrets runtime-owned.
