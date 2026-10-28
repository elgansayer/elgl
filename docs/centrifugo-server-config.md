# Centrifugo server and Redis contract

Issue #1316 completes the existing Centrifugo v5 deployment contract instead of introducing another realtime stack.

## Runtime topology

All Docker Compose variants use the same internal service names:

- `cache` is Redis 7 and is reachable from containers at `redis://cache:6379`.
- `websocket` is Centrifugo v5 and is reachable from the NestJS API at `http://websocket:8000`.
- the NestJS API receives `REDIS_URL=redis://cache:6379` and `CENTRIFUGO_URL=http://websocket:8000` explicitly so host-oriented `.env` defaults such as `localhost` cannot leak into container-to-container traffic.
- Centrifugo continues to expose its Prometheus listener on the internal metrics endpoint scraped at `websocket:8001`.

`config/centrifugo/config.json` owns non-secret realtime structure: Redis engine settings, namespace history/presence limits, connection limits and Prometheus enablement. The `chat`, `room` and `user` namespaces remain bounded and presence-enabled.

## Chat channel authorisation (issue #1691)

The `chat` namespace carries private conversations, so a valid connection token is not enough to read or write a room. It is configured with:

- `allow_subscribe_for_client: false`: a client can only subscribe with a subscription token minted by the API;
- `allow_publish_for_client: false` and `allow_publish_for_subscriber: false`: only the NestJS API publishes, through the Centrifugo HTTP API.

The channels are `chat:<roomId>` (messages, edits, deletions and `status_update` receipt events) and `chat:<roomId>:typing` (typing state).

`POST /chat/subscriptions/token` accepts `{ room_id, stream }` where `room_id` is a UUID and `stream` is `messages` or `typing`. The API verifies that the authenticated user is a member of the room (404 for an unknown room, 403 for a non-member, 503 if membership cannot be verified) and signs a JWT with the existing `CENTRIFUGO_SECRET`:

```json
{ "sub": "<user id>", "channel": "chat:<roomId>[:typing]", "exp": "<now + 5 minutes>" }
```

The token is bound to one channel and one user. `centrifuge-js` asks for a fresh token through `getToken` before it expires, so removing someone from a group stops their subscription within the token lifetime. The endpoint is rate limited (60 requests per minute per user). No token value is logged.

The legacy `publish` and `subscribe_to_publish` options were removed from the `chat` namespace so the explicit `allow_*` options above are the single, unambiguous statement of who may subscribe and publish. The `room` and `user` namespaces are unchanged by this issue.

## Credentials

Centrifugo signing and API credentials are deployment secrets, not configuration source.

The Compose services map the existing application variables into the Centrifugo v5 environment names:

- `CENTRIFUGO_SECRET` -> `CENTRIFUGO_TOKEN_HMAC_SECRET_KEY`
- `CENTRIFUGO_API_KEY` -> `CENTRIFUGO_API_KEY`

The NestJS `CentrifugoService` consumes the same `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` values when minting client tokens and calling the Centrifugo HTTP API. Production startup already rejects missing critical credentials.

Do not commit real signing keys, API keys, connection tokens or Redis credentials. They belong in the deployment secret store or runtime environment. The browser never needs either Centrifugo server credential.

The existing `allowed_origins` behavior is intentionally unchanged by #1316; tightening deployment-specific browser origins should be coordinated with the actual production domains rather than guessed in this infrastructure change.

## Failure behavior

- Missing Centrifugo credentials in production fail the application configuration/startup boundary rather than silently minting unusable credentials.
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
- the `chat` namespace requiring API-authorised subscriptions and rejecting client publication;
- absence of tracked Centrifugo server secrets;
- backend and websocket service-DNS wiring in development, default and production Compose files;
- shared credential injection;
- example environment ownership; and
- Prometheus metrics scraping.

For a deployment smoke test, provide deployment-specific `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY`, start `cache` and `websocket`, verify the Centrifugo health endpoint, then start `api` and verify a minted connection token can establish an authenticated client connection. Then confirm that a member's subscription token subscribes to `chat:<roomId>`, that a subscription without a token is rejected, that a token for another room is rejected, and that a client publish to the `chat` namespace is rejected.

Diagnosing a publication that never reaches clients: the API publishes through the HTTP API, and Centrifugo answers command-level failures (for example error code 102, an unknown channel or namespace, or 103, permission denied) with HTTP 200 and an `error` object rather than an error status. The API treats that as a failed publication and logs `Centrifugo publish rejected` with the channel, the HTTP status and the numeric `code`, so a missing `chat` namespace in the deployed configuration is visible in the API logs instead of looking like a successful send.

## Rollout and rollback

No database migration or persisted-data transformation is required for the Centrifugo configuration itself.

1. Provision deployment-specific `CENTRIFUGO_SECRET` and `CENTRIFUGO_API_KEY` in the deployment secret store.
2. Deploy Redis and Centrifugo with the updated environment mapping.
3. Verify Centrifugo health and Prometheus metrics.
4. Deploy the NestJS API and verify token minting plus an authenticated subscription.
5. For the `chat` namespace authorisation change, deploy the API (which adds `POST /chat/subscriptions/token`) and then the frontend that uses it, and apply the `chat` namespace configuration last. Applying it earlier would stop clients that do not yet request subscription tokens from subscribing to conversations.

Rollback is a normal application/Compose revert. Reverting only the `chat` namespace options restores the previous behaviour immediately and does not affect stored data. Do not restore real credentials to the tracked JSON configuration during rollback; keep secrets runtime-owned.
