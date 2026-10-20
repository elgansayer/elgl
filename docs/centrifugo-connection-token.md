# Centrifugo connection token boundary

`POST /chat/token` is the authenticated boundary that exchanges the current Supabase identity for a short-lived Centrifugo connection JWT.

## Contract

- The route is protected by `SupabaseAuthGuard`; callers do not supply a user id in the request body.
- The JWT `sub` claim is always the authenticated Supabase user id.
- Tokens minted through `ChatService.generateConnectionToken()` expire one hour after issuance.
- The endpoint returns only `{ "token": "..." }` on success. The signing secret is never returned to the browser.
- Connection attempts are additionally constrained by the controller throttle and the Redis-backed Centrifugo connection-rate limiter.
- Rate-limit failures return HTTP 429 and a `Retry-After` response header. Authentication failures return HTTP 401.
- Signing failures are errors. The backend must not return an empty, fabricated, or unsigned token as a successful response.

The browser should request a new token when establishing or re-establishing its Centrifugo connection rather than persisting a token as long-lived application state.

## Configuration and secrets

Production requires `CENTRIFUGO_API_KEY` and `CENTRIFUGO_SECRET`; `CentrifugoService` fails startup when either credential is absent in production. `CENTRIFUGO_URL` points at the Centrifugo instance. Redis is used for distributed connection-rate limiting when available.

Do not log connection JWTs, the signing secret, API keys, Supabase access tokens, or Authorization headers. Issue/token diagnostics should identify the operation and failure class without credential material.

## Verification

The token contract is covered by:

- `backend/src/chat/chat-token.contract.spec.ts` for route/auth metadata, the authenticated `sub` claim, one-hour expiry, and fail-closed signing behavior;
- `backend/src/chat/chat.controller.spec.ts` for successful token responses, unauthenticated requests, and connection-rate limiting;
- `backend/src/chat/centrifugo.service.spec.ts` for signing-secret configuration and Redis-backed connection-rate limiting.

Run the backend unit suite with the repository's canonical backend test command. Standard pull-request CI remains authoritative for lint, type checking, build, unit tests, E2E tests, and dependency review.

## Rollout and rollback

No schema migration or client payload migration is required. The route and response shape already exist, so this contract can roll out with the normal backend deployment.

Rollback is a normal application-code revert. Do not roll back to a token endpoint that accepts caller-supplied identities, exposes signing credentials, bypasses authentication, or treats signing failures as successful token issuance.
