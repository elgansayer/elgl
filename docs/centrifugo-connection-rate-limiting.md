# Centrifugo WebSocket connection rate limiting

Issue #1849 audited WebSocket connection rate limiting end to end. The controls below were already delivered by earlier work: the Centrifugo node limits, the nginx edge limits, the Redis-backed `POST /chat/token` limiter and the browser backoff. No second limiter was introduced. This change makes the NestJS limiter observable, locks the Centrifugo and edge settings behind the contract test, and documents how the layers fit together.

## Layers

A connection attempt passes through up to four independent controls. Each protects a different resource, so none of them replaces another.

| Layer                                                | Control                                                                                                                       | Scope                                    | Default                           | Client sees                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------------- | ---------------------------------------------- |
| Edge (`config/nginx/nginx.conf`, production Compose) | `limit_req_zone` `centrifugo_limit` with `limit_req ... burst=10 nodelay`                                                     | each client address, `/centrifugo/` only | 5 requests per second             | HTTP 503 (nginx default)                       |
| Edge                                                 | `limit_conn_zone` `centrifugo_conn_limit` with `limit_conn ... 20`                                                            | each client address, `/centrifugo/` only | 20 concurrent connections         | HTTP 503 (nginx default)                       |
| Centrifugo node (`config/centrifugo/config.json`)    | `client_connection_rate_limit`                                                                                                | each node, all clients                   | 10 new connections per second     | HTTP 503, official SDKs reconnect with backoff |
| Centrifugo node                                      | `client_user_connection_limit`                                                                                                | each node, each authenticated user       | 5 concurrent connections          | additional connections are refused             |
| Centrifugo node                                      | `client_channel_limit`                                                                                                        | each client                              | 50 channel subscriptions          | further subscriptions are refused              |
| NestJS `POST /chat/token`                            | Redis sliding window (`CENTRIFUGO_CONNECTION_RATE_LIMIT` per `CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC`) plus the route throttle | each authenticated user                  | 5 tokens per 60 seconds           | HTTP 429 with `Retry-After`                    |
| Browser (`CentrifugeService`)                        | exponential backoff with jitter, `Retry-After` aware                                                                          | each tab                                 | 8 attempts, 500 ms base, 30 s cap | connection status `rate-limited` while waiting |

How the layers fit together:

- A connection token is valid for one hour and can back several handshakes. The token limiter therefore bounds token minting and refresh, not handshakes. Handshakes are bounded by the edge and node limits.
- The Centrifugo node limits are per node. Centrifugo documents `client_connection_rate_limit` and `client_user_connection_limit` as per node, so cluster-wide ceilings grow with the node count.
- `client_connection_rate_limit` and `client_user_connection_limit` default to `0`, which Centrifugo treats as unlimited. The contract test requires positive integers for both and for `client_channel_limit`, so a limit cannot be disabled, or silently fall back to a Centrifugo default, by accident.
- `client_user_connection_limit` (5) and the default token budget (5 per minute) are aligned: each tab fetches its own token and holds one connection.

## Token endpoint behaviour

1. The caller must be authenticated (`SupabaseAuthGuard`, HTTP 401 otherwise) and within the route throttle (`@Throttle`, 5 requests per 60 seconds, see `docs/api-auth-throttling.md`). The connection limiter only runs after both.
2. `CentrifugoService.checkConnectionRateLimit()` runs one atomic Lua script against a Redis sorted set keyed `centrifugo:conn_rate:<identity>`. If the script could not be loaded it falls back to a pipeline that is not fully atomic under contention. Keys expire after the window, so no cleanup job is needed.
3. When the budget is spent the endpoint returns HTTP 429 with a `Retry-After` header of at least one second. The value comes from the oldest entry in the window (Lua) or the whole window (fallback). `CentrifugeService` waits for it, capped at 30 seconds.

## Failure behaviour

The limiter is defence in depth, so it fails open: if Redis cannot answer, the token request is allowed instead of locking every user out of realtime during a Redis incident. Failing open is never silent.

| Condition                             | Outcome                                                                     | Signal                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Budget exceeded                       | HTTP 429 with `Retry-After`, no token minted                                | `limited` count and warning `centrifugo_connection_rate_limited`                                                                                                                             |
| Redis unreachable when the API starts | limiter stays disabled until the API process restarts                       | warning `centrifugo_connection_rate_limiter_disabled` once, then `degraded` count and warning `centrifugo_connection_rate_limiter_degraded` with reason `redis_unavailable` on every request |
| Redis command fails while running     | request allowed; commands fail fast because the client has no offline queue | `degraded` count and error `centrifugo_connection_rate_limiter_degraded` with reason `redis_error`                                                                                           |
| Unusable reply from Redis             | request allowed                                                             | `degraded` count and warning `centrifugo_connection_rate_limiter_degraded` with reason `malformed_reply`                                                                                     |

The edge and Centrifugo node limits keep protecting handshakes whether or not the NestJS limiter is healthy.

## Observability

Metric, exposed by the NestJS API at `/api/metrics` and scraped by Prometheus:

```text
hellotalk_centrifugo_connection_rate_limit_total{outcome="allowed|limited|degraded"}
```

The only label is the closed `outcome` enum, so no user id, address or token reaches the metrics endpoint. The metrics client creates a labelled series on its first increment, so alert expressions must tolerate absent series.

Structured log events (nestjs-pino, correlated through the request-scoped log context):

| Event                                         | Level                                                                  | Fields                                      |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `centrifugo_connection_rate_limited`          | warn                                                                   | `retryAfterMs`, `limit`, `windowSec`        |
| `centrifugo_connection_rate_limiter_degraded` | warn (`redis_unavailable`, `malformed_reply`) or error (`redis_error`) | `reason`, optional `errorName`, `errorCode` |
| `centrifugo_connection_rate_limiter_disabled` | warn, once at startup                                                  | `reason`, `errorName`, optional `errorCode` |

Logs never contain the user id, IP address, connection token, Redis URL or driver error message. Only the error class name and its code (for example `ECONNREFUSED`) are recorded.

Example alert expressions (tune thresholds to real traffic):

```promql
# The limiter is failing open.
increase(hellotalk_centrifugo_connection_rate_limit_total{outcome="degraded"}[5m]) > 0

# More than a fifth of token requests are being refused for a sustained period.
sum(rate(hellotalk_centrifugo_connection_rate_limit_total{outcome="limited"}[10m]))
  / sum(rate(hellotalk_centrifugo_connection_rate_limit_total[10m])) > 0.2
```

Edge and node rejections both reach the client as HTTP 503. To attribute them, check the nginx error log: nginx names the zone in its `limiting requests` and `limiting connections` lines. Anything else on the Centrifugo listener is a node-level rejection.

## Tuning

- `CENTRIFUGO_CONNECTION_RATE_LIMIT` and `CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC` set the per-user token budget. Both must be positive integers and are validated at startup by `backend/src/config/validation.schema.ts`. Raise the budget together with `client_user_connection_limit` if users legitimately open more tabs or devices.
- `client_connection_rate_limit` is the reconnect-storm valve. After a Centrifugo restart, clients are readmitted at this rate per node, so recovering N clients takes roughly N divided by the rate in seconds. The official SDKs retry rejected handshakes with jittered exponential backoff. Size the value from the expected reconnect population before raising or lowering it.
- The nginx limits are per client address. Raise `rate` and `burst` if shared egress addresses such as mobile carrier NAT or offices are being refused.
- Edit `config/centrifugo/config.json` and restart Centrifugo for node limits. Edit the environment and restart the API for the token budget. Do not set `client_connection_rate_limit` or `client_user_connection_limit` to `0` and do not remove them: both then default to unlimited. Removing `client_channel_limit` falls back to the Centrifugo default of 128.

## Deployment checks and known limits

- **Edge coverage.** The tracked nginx proxy only limits `/centrifugo/`. The tracked `frontend/src/environments/environment.prod.ts` holds the placeholder `wss://example.com/connection/websocket`. Make sure the deployed `centrifugoUrl` reaches Centrifugo through a proxy that applies a per-address limit (for the tracked nginx that is `wss://<host>/centrifugo/connection/websocket`). Production Compose also publishes Centrifugo on host port 8000: keep that port unreachable from the internet, otherwise the edge limits can be bypassed. The node limits still apply on that port.
- **Limiter recovery.** If `centrifugo_connection_rate_limiter_disabled` was logged, restart the API once Redis is healthy to re-enable the token budget.
- **Namespace keys.** The tracked namespaces also carry `channel_limit` and `channel_subscription_rate_limit`. Neither is listed in the Centrifugo v5 reference, so they are not counted as enforced controls here. They are left untouched; the enforced per-client bound is the global `client_channel_limit`.

## Rollout and rollback

No schema migration, API contract change or client payload change is required. The HTTP 429 contract of `POST /chat/token` is unchanged. Deploy the backend normally: the metric and the request-time log events appear once the limiter makes its first decision, and the startup warning appears at boot if Redis is unreachable.

Rollback is a normal application revert. The metric series and the three log events disappear, so dashboards and alerts that reference them must tolerate their absence. Do not roll back to a configuration where any of the three `client_*` Centrifugo limits is `0` or missing, or where the nginx `limit_req` and `limit_conn` directives are removed from the `/centrifugo/` location.

## Verification

```bash
node --test scripts/centrifugo-config-contract.test.mjs
cd backend && npx vitest run src/chat/centrifugo.service.spec.ts src/chat/chat.controller.spec.ts src/chat/chat-token.controller.contract.spec.ts src/metrics/metrics.service.spec.ts
```

The contract test locks the Centrifugo node limits, the nginx zones and their attachment to `/centrifugo/`, the example environment budgets and this document's list of tunables and signals. The backend specs cover the limiter decisions, the fail-open paths, the sanitised log fields and the exported metric.

Manual smoke test: request `POST /chat/token` more often than the budget with one authenticated user and confirm HTTP 429 with `Retry-After`, an increment of the `limited` outcome and a `centrifugo_connection_rate_limited` log line without any user identity.
