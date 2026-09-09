# Centrifugo browser client lifecycle

## Scope

The Angular `CentrifugeService` is the single browser-side owner of the Centrifugo connection. Feature code subscribes through that service instead of creating independent WebSocket clients.

The repository uses the current `centrifuge` npm package. This is the maintained JavaScript client package that fulfils the older issue wording referring to `centrifuge-js`.

## Authentication and token refresh

1. The browser must already have a Supabase access token.
2. `CentrifugeService` requests a short-lived Centrifugo connection token from `POST /chat/token` with the current Supabase bearer token.
3. The initial Centrifugo client is created with that short-lived token.
4. The client `getToken` callback mints a fresh connection token whenever Centrifugo requires one, including long-lived tabs and reconnects.
5. Token requests are deduplicated only within the same Supabase session. A changed access token always creates a new request so credentials cannot cross account boundaries.
6. Missing authentication fails closed: no WebSocket client is created.

Connection tokens and Supabase tokens are never logged.

## Server token contract

`POST /chat/token` is protected by `SupabaseAuthGuard`. The request does not accept a user id in its body or query string. The authenticated Supabase user id is the only source for the Centrifugo JWT `sub` claim.

Connection JWTs use the shared `CENTRIFUGO_SECRET`, are signed explicitly with `HS256`, and expire one hour after minting. The signing boundary rejects missing or blank subjects, expired claims, non-integer expiry claims, and expiry claims beyond the one-hour connection-token lifetime. This keeps the generic signing helper from becoming a path for unexpectedly long-lived realtime credentials.

The endpoint has two rate-limit layers:

- NestJS throttling limits token requests per API instance.
- The Centrifugo service applies the configured Redis-backed sliding window across API replicas.

When Redis is unavailable, the distributed limiter degrades to the existing NestJS throttle instead of preventing authenticated users from reconnecting. When the distributed limiter rejects a request, the endpoint returns `429` and rounds its calculated wait time up into the `Retry-After` header. If Redis cannot provide a precise retry duration, the configured connection-rate window is used.

Token-signing failures and empty token results fail closed with `503` and the stable message `Realtime authentication is temporarily unavailable.` Raw signing errors, user ids, Supabase credentials, connection tokens, and signing secrets are not copied into that response. The Centrifugo service emits only the sanitised `centrifugo_connection_token_mint_failed` event and failure classification for signing failures.

## Connection states

The service exposes two Angular signals:

- `isConnected`: a boolean suitable for simple online/offline UI decisions.
- `connectionStatus`: `disconnected`, `connecting`, `reconnecting`, `connected`, `rate-limited`, or `error`.

Centrifugo handles transient transport reconnects internally. A terminal `disconnected` event causes the service to create a fresh client with bounded exponential backoff. Initial token-mint failures use the same bounded retry policy. HTTP `429` responses honour `Retry-After`, capped at 30 seconds.

After eight terminal/initial retry attempts the service enters `error` and stops retrying. A successful connection resets the retry budget.

## Subscription recovery

Desired channel handlers are stored separately from active Centrifugo `Subscription` objects. When a client is replaced, active subscriptions are torn down and recreated from the desired-handler map. Re-subscribing to an existing channel replaces its publication callback rather than stacking duplicate handlers.

Explicit `unsubscribe()` removes both active and desired state. Explicit `disconnect()` clears all desired subscriptions, cancels pending retry timers, invalidates in-flight connection attempts, and prevents stale token responses from creating a client after logout.

## Failure and privacy behaviour

- A missing Supabase session leaves the service disconnected.
- Empty/malformed token responses fail closed and retry within the bounded policy.
- Token endpoint rate limiting is represented explicitly as `rate-limited` rather than being reported as connected.
- A response from an obsolete connection generation is ignored after logout or another lifecycle reset.
- Logs contain only generic lifecycle failures, never channel payloads, user content, bearer tokens, connection tokens, signing secrets, or authenticated user ids from the token-mint path.

## Verification

Backend token coverage lives in:

- `backend/src/chat/chat.controller.spec.ts` for the authenticated happy path and basic rate-limit behavior;
- `backend/src/chat/chat-token.controller.contract.spec.ts` for precise `Retry-After`, degraded retry metadata, empty-token rejection, and sanitised signing failure behavior; and
- `backend/src/chat/centrifugo.service.spec.ts` for `sub`, one-hour expiry, HS256 signing, bounded claim validation, and sanitised signing failures.

Focused browser regression coverage lives in `frontend/src/app/services/centrifuge.service.spec.ts` and covers:

- duplicate subscription-handler prevention;
- subscription restoration after client replacement;
- unauthenticated fail-closed behaviour;
- concurrent connection/token-request deduplication;
- token refresh using the current auth session;
- stale response rejection after disconnect;
- state-signal transitions;
- `Retry-After` handling; and
- cancellation of scheduled retries on intentional disconnect.

Run the backend chat/Centrifugo tests plus the normal backend verification before deployment. The repository CI remains the authoritative clean-environment verification for connector-authored branches.

## Rollout and rollback

No database migration, Centrifugo channel change, or persisted-data transformation is required.

Roll out the NestJS API normally with the existing production `CENTRIFUGO_SECRET`, `CENTRIFUGO_API_KEY`, Redis, and Centrifugo configuration. Smoke-test an authenticated `POST /chat/token`, verify the JWT subject matches the caller, verify its expiry is approximately one hour, then establish a Centrifugo connection and exercise token refresh from a long-lived browser session.

The Angular client remains backward compatible with the unchanged successful response shape `{ "token": "..." }`.

Rollback is code-only. Revert the backend token changes if required; no database or realtime data cleanup is needed. Keep signing credentials runtime-owned and do not place them in source-controlled Centrifugo configuration during rollback.
