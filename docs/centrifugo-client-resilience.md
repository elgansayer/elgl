# Centrifugo client resilience

## Scope

The Angular application uses the repository's existing `centrifuge` package and the global `CentrifugeService` in `frontend/src/app/services/centrifuge.service.ts`. The historical issue names the client as `centrifuge-js`; the maintained dependency in this repository is exposed as the `centrifuge` npm package, so no parallel realtime client package is introduced.

The service owns browser-side Centrifugo connection state, token acquisition, reconnect scheduling, channel subscriptions and client-side publishing. NestJS remains the authority for connection-token minting through `POST /chat/token`.

## Authentication boundary

`CentrifugeService.connect()` requires an authenticated Supabase access token before requesting a Centrifugo connection token. If no Supabase token exists, the service remains disconnected and does not send an empty `Authorization` header or start a retry loop.

The browser never stores or constructs the Centrifugo signing secret. The short-lived connection JWT comes from the authenticated NestJS endpoint.

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
- intentional disconnect cancels and blocks reconnect timers.

Repository validation should include:

```bash
cd frontend
npm run lint:check
npm test -- --watch=false
npm run build
```

The pull-request CI suite remains authoritative for the complete repository verification and independent review gates.

## Rollout and rollback

There is no schema, API response-shape or server configuration change. Deploy the frontend normally after required checks pass.

Rollback is a normal application revert. No database or credential rollback is required. A rollback must not introduce client-side Centrifugo signing secrets or bypass the authenticated `POST /chat/token` boundary.
