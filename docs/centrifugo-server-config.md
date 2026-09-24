# Centrifugo server and Redis contract

Issue #1316 established the existing Centrifugo v5 deployment contract. Issue #1687 closes the remaining production browser-origin boundary without introducing another realtime stack.

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

The NestJS `CentrifugoService` consumes the same `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` values when minting client tokens and calling the Centrifugo HTTP API. Production startup already rejects missing critical credentials.

Do not commit real signing keys, API keys, connection tokens or Redis credentials. They belong in the deployment secret store or runtime environment. The browser never needs either Centrifugo server credential.

## Browser origin policy

The tracked Centrifugo v5 config retains its permissive development fallback so local Compose and ad-hoc development environments remain backward compatible. Production does not rely on that fallback.

`docker-compose.prod.yml` now requires `CENTRIFUGO_ALLOWED_ORIGINS` and passes it to Centrifugo. Compose rendering fails before deployment when the variable is missing. Centrifugo v5 environment variables override the tracked config file, so production browser WebSocket requests are limited to the deployment-owned allowlist.

Set the value to the exact browser origins that are allowed to open realtime connections. Multiple origins use Centrifugo's space-separated string-list format, for example:

```bash
CENTRIFUGO_ALLOWED_ORIGINS="https://app.example.com https://www.example.com"
```

Do not set production to `*`. Wildcard browser origins weaken the WebSocket origin boundary and make cross-origin connection abuse easier. Changes to public domains must update the deployment environment before the replacement Centrifugo container starts.

## Failure behavior

- Missing Centrifugo credentials in production fail the application configuration/startup boundary rather than silently minting unusable credentials.
- Missing `CENTRIFUGO_ALLOWED_ORIGINS` fails production Compose interpolation before Centrifugo starts.
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
- an explicit, fail-fast production browser-origin allowlist;
- example environment ownership; and
- Prometheus metrics scraping.

For a deployment smoke test, provide non-placeholder `CENTRIFUGO_SECRET`, `CENTRIFUGO_API_KEY` and a deployment-specific `CENTRIFUGO_ALLOWED_ORIGINS`, start `cache` and `websocket`, verify the Centrifugo health endpoint, then start `api` and verify a minted connection token can establish an authenticated client connection from an allowed browser origin. Verify an unrelated browser origin is rejected.

## Rollout and rollback

No database migration or persisted-data transformation is required.

1. Provision non-placeholder `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` in the deployment secret store.
2. Set `CENTRIFUGO_ALLOWED_ORIGINS` to the exact production browser origins.
3. Validate `docker compose -f docker-compose.prod.yml config` with the deployment environment.
4. Deploy Redis and Centrifugo with the updated environment mapping.
5. Verify Centrifugo health, Prometheus metrics and allowed/disallowed browser-origin behavior.
6. Deploy the NestJS API and verify token minting plus an authenticated subscription.

Rollback is a normal application/Compose revert. If rollback restores the previous Compose file, keep the production reverse-proxy origin and authentication controls in place and do not restore real credentials to tracked JSON configuration. Reapply the explicit origin allowlist before the next production promotion.
