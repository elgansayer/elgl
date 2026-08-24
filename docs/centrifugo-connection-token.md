# Centrifugo connection token endpoint

## Scope

`POST /chat/token` is the only browser-facing boundary for minting Centrifugo connection JWTs. The Angular realtime client calls it with the current Supabase access token and keeps the returned Centrifugo credential in memory. The browser never receives `CENTRIFUGO_SECRET` and never signs its own realtime token.

The route already lives in `ChatController` under the controller-wide `SupabaseAuthGuard`. This issue completes the production contract around that existing endpoint rather than introducing a second token API.

## Authentication and token contract

A successful request requires a verified Supabase principal. The token payload minted by `ChatService.generateConnectionToken()` contains:

- `sub`: the authenticated Supabase user ID, never a caller-supplied ID;
- `exp`: one hour after issuance.

`CentrifugoService.signJwt()` signs the payload with the backend-only `CENTRIFUGO_SECRET` and explicitly pins the JWT algorithm to `HS256`, matching the Centrifugo HMAC connection-token contract. A missing or whitespace-only signing secret fails closed. Production startup also rejects a whitespace-only `CENTRIFUGO_SECRET`, so a deployment cannot intentionally start in a state that can mint unsigned or empty-secret credentials.

The older `CentrifugoService.generateConnectionToken()` helper remains for compatibility with repository code/tests that reference it, but the HTTP endpoint does not use that helper. The authoritative browser token path is `ChatController -> ChatService.generateConnectionToken() -> CentrifugoService.signJwt()`.

## Abuse resistance

The route has two rate-limit layers:

1. NestJS `@Throttle` limits token requests to five per 60 seconds at the route boundary.
2. `CentrifugoService.checkConnectionRateLimit()` applies the configured Redis-backed sliding window (`CENTRIFUGO_CONNECTION_RATE_LIMIT` and `CENTRIFUGO_CONNECTION_RATE_WINDOW_SEC`) before a token is minted.

The Redis limiter is deliberately a secondary distributed abuse control. If Redis is unavailable, it degrades open so a Redis outage does not disconnect every active learner; the NestJS route throttle and Supabase authentication boundary remain in force.

A rate-limited request returns HTTP 429 with `Retry-After`. The Angular `CentrifugeService` already honors this response and uses bounded reconnect backoff instead of spinning on the token endpoint.

## Failure and privacy behavior

- Missing or invalid Supabase credentials are rejected by `SupabaseAuthGuard` before token minting.
- Missing token-signing configuration fails closed; no token is produced.
- Signing exceptions propagate as request failures rather than falling back to a mock or browser-generated credential.
- Tokens, Supabase access tokens, signing secrets and request authorization headers must never be logged.
- The signing failure diagnostic is intentionally stable and contains no secret, JWT payload or user content.
- No database row is created by token minting, so there is no retention or account-deletion migration for this endpoint.

Realtime message durability remains separate from this connection credential. Durable chat writes must continue through authenticated NestJS message APIs; possessing a valid Centrifugo connection token is not a persistence or authorization bypass.

## Client refresh behavior

`frontend/src/app/services/centrifuge.service.ts` supplies both the initial token and a `getToken` callback to the maintained `centrifuge` client. Long-lived tabs therefore request a new short-lived JWT from the authenticated NestJS endpoint when Centrifugo needs refreshed credentials. Account/session changes are isolated by the frontend token-request deduplication key, and logout disconnects the client rather than reusing a previous account's credential.

## Verification

Focused backend coverage includes the existing controller and service suites plus `centrifugo-token.spec.ts`:

```bash
cd backend
npm test -- --run \
  src/chat/chat.controller.spec.ts \
  src/chat/chat.service.spec.ts \
  src/chat/centrifugo.service.spec.ts \
  src/chat/centrifugo-token.spec.ts
npm run lint:check
npm run build
```

The token-specific regression suite verifies the authenticated `sub` payload is signed with explicit HS256, blank runtime secrets fail closed, and whitespace-only production secrets prevent startup. Existing controller coverage verifies authenticated success, unauthenticated rejection and 429 handling.

Repository GitHub Actions remain authoritative for the full backend, frontend, database, security and governance gates.

## Rollout

No schema or API shape migration is required. Before deployment, verify production has non-empty `CENTRIFUGO_SECRET`, `CENTRIFUGO_API_KEY` and `CENTRIFUGO_URL` values that match the Centrifugo server configuration. Deploy the backend normally; existing Angular clients continue using the same `POST /chat/token` response shape `{ "token": "..." }`.

Monitor authentication/rate-limit failure counts and Centrifugo connection failures, but do not add token values, authorization headers or user content to diagnostics.

## Rollback

Revert the application commits in this PR. There is no database state to unwind. Do not work around a signing/configuration failure by exposing `CENTRIFUGO_SECRET` to the frontend, accepting caller-supplied `sub` values, or minting unsigned/fallback credentials.