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
- Logs contain only generic lifecycle failures, never channel payloads, user content, bearer tokens, or connection tokens.

## Verification

Focused regression coverage lives in `frontend/src/app/services/centrifuge.service.spec.ts` and covers:

- duplicate subscription-handler prevention;
- subscription restoration after client replacement;
- unauthenticated fail-closed behaviour;
- concurrent connection/token-request deduplication;
- token refresh using the current auth session;
- stale response rejection after disconnect;
- state-signal transitions;
- `Retry-After` handling; and
- cancellation of scheduled retries on intentional disconnect.

Run the focused frontend tests and normal frontend verification before deployment.

## Rollout and rollback

This change does not alter the `/chat/token` API contract, Centrifugo server configuration, channel names, or persisted data. It is safe to roll out independently of the backend as long as the existing token endpoint remains available.

Rollback is code-only: revert the Angular service/tests/documentation. No database or server-side data migration is required.
