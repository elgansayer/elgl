# Centrifugo client resilience

## Scope

The Angular application uses the repository's existing `centrifuge` package and the global `CentrifugeService` in `frontend/src/app/services/centrifuge.service.ts`. The historical issue names the client as `centrifuge-js`; the maintained dependency in this repository is exposed as the `centrifuge` npm package, so no parallel realtime client package is introduced.

The service owns browser-side Centrifugo connection state, token acquisition, reconnect scheduling, channel subscriptions and client-side publishing. NestJS remains the authority for connection-token minting through `POST /chat/token`.

## Authentication boundary

`CentrifugeService.connect()` requires an authenticated Supabase access token before requesting a Centrifugo connection token. If no Supabase token exists, the service remains disconnected and does not send an empty `Authorization` header or start a retry loop.

The browser never stores or constructs the Centrifugo signing secret. The short-lived connection JWT comes from the authenticated NestJS endpoint.

## Subscription authorisation

Conversation channels are private. For `chat:<roomId>` and `chat:<roomId>:typing` the service creates the Centrifugo subscription with a `getToken` callback that calls `POST /chat/subscriptions/token` with `{ room_id, stream }` (`messages` or `typing`) and the caller's Supabase access token. The API verifies room membership and returns a short-lived token bound to that channel.

- The callback never runs without a Supabase access token, and channel names that are not exactly `chat:<roomId>` or `chat:<roomId>:typing` are refused locally.
- An HTTP 401, 403 or 404 becomes centrifuge-js's `UnauthorizedError`, which ends that subscription instead of retrying. Any other failure (network, 5xx, 429) is rethrown so the library retries with its own backoff.
- Tokens are requested again by the library before they expire, so losing room membership stops delivery within the token lifetime.
- Other channels (`room`, `user`) are subscribed exactly as before.

Publication handlers receive `(data, meta)` where `meta.publisherId` is the Centrifugo-verified user id when the publication came from a client. The chat namespace no longer accepts client publications, so consumers must not rely on it for identity; a payload that names someone other than a verified publisher is treated as an impersonation attempt (see `docs/chat-typing-presence.md`).

## Connection state

The service exposes two Angular signals:

- `isConnected`: boolean connectivity for consumers that only need an online/offline realtime state.
- `connectionStatus`: lifecycle status for diagnostics and UI state where needed.

A successful connection resets the reconnect attempt counter. Transport or token failures set the connection state to an error/disconnected state and use bounded retry behaviour.

## Reconnection policy

Unexpected disconnects use exponential backoff with jitter. HTTP 429 responses honour `Retry-After` when supplied, capped by the service maximum delay. Retries are bounded so an unavailable realtime provider cannot create an infinite tight loop.

An explicit `disconnect()` is different from a transport failure. It cancels any scheduled retry, marks the disconnect as intentional, clears active and desired channel subscriptions, and prevents a later `disconnected` callback from immediately reconnecting the client.

## Subscription continuity

Desired channel handlers are tracked separately from Centrifugo `Subscription` instances. This matters because a reconnect that creates a new Centrifugo client invalidates subscription objects owned by the previous client.

When a new client is created:

1. active subscription objects from the old client are unsubscribed;
2. desired channel handlers remain registered;
3. fresh subscription objects are created against the new client;
4. each channel has one current publication handler.

Calling `unsubscribe(channel)` removes both the active subscription and the desired handler, so a deliberately removed channel cannot reappear after a reconnect.

## Failure and logging policy

Provider and network exceptions are not emitted with raw error/context payloads from the service. Logs use stable diagnostic messages rather than dumping tokens, request headers or provider objects.

Publishing remains best effort at this layer. Callers that require durable delivery must use the canonical NestJS message APIs rather than treating client-side Centrifugo publish as persistence.

## Verification

Focused regression coverage in `centrifuge.service.spec.ts` verifies:

- duplicate subscriptions do not stack publication handlers;
- desired subscriptions can be restored on a replacement client;
- the latest handler is preserved after client replacement;
- an explicitly unsubscribed channel is not restored;
- missing authentication does not call the token endpoint;
- intentional disconnect cancels and blocks reconnect timers;
- chat subscriptions request a channel-scoped subscription token and other channels do not;
- authorisation refusals (401, 403, 404) stop the subscription while transient failures are retried by the library;
- the verified publisher is passed to handlers separately from the payload.

Repository validation should include:

```bash
cd frontend
npm run lint:check
npm test -- --watch=false
npm run build
```

The pull-request CI suite remains authoritative for the complete repository verification and independent review gates.

## Rollout and rollback

The frontend depends on `POST /chat/subscriptions/token`, so deploy the backend first and apply the Centrifugo `chat` namespace configuration last (see `docs/centrifugo-server-config.md`). There is no schema change.

Rollback is a normal application revert. No database or credential rollback is required. A rollback must not introduce client-side Centrifugo signing secrets or bypass the authenticated `POST /chat/token` and `POST /chat/subscriptions/token` boundaries.
