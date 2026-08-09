# Virtual Coin Economy -- API Architecture Documentation

## Overview

The Virtual Coin Economy is a server-authoritative in-app currency system that powers monetisation and engagement features across the HelloTalk Clone platform. All coin operations are processed server-side with cryptographic receipt verification to prevent client-side tampering.

## Architecture Principles

1. **Server Authority**: The client NEVER determines coin amounts. The server derives amounts from platform-verified product IDs and server-side `COIN_PACKAGES` definitions.
2. **Receipt Verification**: All purchases are cryptographically verified with the respective platform API (Apple App Store, Google Play, or Stripe) before coins are credited.
3. **Duplicate Prevention**: Transaction IDs are tracked and unique to prevent double-crediting.
4. **Real-Time Propagation**: Coin balance changes and gift events are broadcast via Centrifugo WebSocket for instant UI updates.

## Technology Stack

| Component | Technology |
|---|---|
| API Framework | NestJS (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Cache | Redis (via ioredis) |
| Payment Processing | Stripe SDK, Apple Server API, Google Play Developer API |
| Real-Time Events | Centrifugo WebSocket |
| Logging | Pino (structured JSON) |
| Rate Limiting | `@nestjs/throttler` + custom `EconomyRateLimiterGuard` |
| API Documentation | Swagger/OpenAPI (`@nestjs/swagger`) |

## Endpoint Reference

All endpoints are prefixed with `/api/economy` and require Supabase JWT authentication (Bearer token). The Swagger UI is available at `/api/docs`.

### Data Flow: Coin Purchase

```
Client                     NestJS API                    Platform API            Database
  |                            |                              |                      |
  |-- POST /create-checkout -->|                              |                      |
  |   { package_id }          |-- stripe.checkout.sessions   |                      |
  |                            |   .create()                 |                      |
  |<-- { sessionUrl } --------|                              |                      |
  |                            |                              |                      |
  | [redirect to Stripe]       |                              |                      |
  | [complete payment]         |                              |                      |
  |                            |                              |                      |
  |-- POST /purchase-coins -->|                              |                      |
  |   { receipt_token }       |-- verify receipt ----------->|                      |
  |                            |<-- { productId, txnId } ----|                      |
  |                            |                              |                      |
  |                            | [derive coin amount from     |                      |
  |                            |  COIN_PACKAGES by productId] |                      |
  |                            |                              |                      |
  |                            | [check duplicate txnId]      |                      |
  |                            |                              |                      |
  |                            |-- INSERT purchase record --->|                      |
  |                            |-- UPDATE coin balance ------>|                      |
  |                            |                              |                      |
  |<-- { coins, new_balance } |                              |                      |
```

### Data Flow: Gift Sending

```
Client A                NestJS API              Centrifugo            Client B
  |                        |                         |                    |
  |-- POST /send-gift ---->|                         |                    |
  |   { receiver_id,       |                         |                    |
  |     gift_id }          |                         |                    |
  |                        | [verify balance >= cost]|                    |
  |                        | [deduct from sender]    |                    |
  |                        | [insert gift record]    |                    |
  |                        |                         |                    |
  |                        |-- publish gift event -->|                    |
  |                        |   { sender, gift, room }|-- push to -------->|
  |                        |                         |   receiver channel |
  |<-- { success,          |                         |                    |
  |      coins_remaining } |                         |                    |
```

## Security Model

### Receipt Verification Chain

1. **Apple IAP**: Receipt is verified against `https://buy.itunes.apple.com/verifyReceipt` (production) or sandbox endpoint. The response's `latest_receipt_info` is parsed for `product_id` and `transaction_id`.
2. **Google Play**: Purchase token is verified via `androidpublisher.purchases.products.get()` API. The `purchaseState` must be 0 (purchased) and `consumptionState` must be 0 (not yet consumed).
3. **Stripe**: Checkout session is retrieved via `stripe.checkout.sessions.retrieve(sessionId)`. The session `payment_status` must be `paid` and `status` must be `complete`.

### Coin Package Definitions (Server-Side)

Coin amounts are NEVER sent from the client. They are derived from the server-side `COIN_PACKAGES` constant, keyed by `platform_product_id`:

```typescript
export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'coins_small',
    name: 'Small Coin Pack',
    coins: 100,
    price: 499,  // in cents/pence
    price_ukp: 4,
    price_usd: 4.99,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.small',
      android: 'com.linguaexchange.coins.small',
      web: 'price_small_coins',
    },
  },
  // ... medium, large, mega packs
];
```

### Rate Limiting

Each economy endpoint has two layers of rate limiting:

1. **Global Throttle** (`@Throttle`): Standard NestJS throttler limits.
2. **Per-User Rate Limit** (`@EconomyRateLimit`): Custom guard using Redis counters with per-user sliding windows.

| Endpoint | Global Limit | Per-User Limit |
|---|---|---|
| GET /catalog | 30 req/min | N/A (public) |
| GET /packages | 30 req/min | N/A (public) |
| GET /balance | 30 req/min | 20 req/60s |
| POST /daily-check-in | 3 req/min | 3 req/60s |
| POST /create-checkout-session | 5 req/min | 5 req/60s |
| POST /purchase-coins | 5 req/min | 5 req/60s |
| POST /send-gift | 10 req/min | 10 req/60s |
| GET /sticker-packs | 20 req/min | N/A (public) |
| POST /unlock-sticker-pack | 5 req/min | 10 req/60s |

### Caching Strategy

| Data | Cache Level | TTL | Rationale |
|---|---|---|---|
| Gift catalogue | Public CDN | 1h browser / 24h edge | Rarely changes |
| Coin packages | Public CDN | 1h browser / 24h edge | Changes only with app updates |
| User balance | Never cached | N/A | Strictly private data |
| Sticker packs | Public CDN | 5min browser / 30min edge | User-ownership freshness |
| Mutation endpoints | Never cached | N/A | Must always hit server |

## DTO Validation

All request bodies are validated using `class-validator` decorators with `whitelist: true` and `forbidNonWhitelisted: true` at the global pipe level. Input is sanitised via `SanitiseHtmlPipe` before reaching controllers.

## Monitoring & Observability

- All economy transactions are logged as structured JSON via Pino.
- Purchase verification failures emit warning-level logs with platform and error context.
- Duplicate transaction rejections emit info-level logs with the transaction ID.
- Coin balance changes are logged at debug level.

## Related Files

| File | Purpose |
|---|---|
| `backend/src/economy/economy.controller.ts` | REST endpoint definitions with Swagger decorators |
| `backend/src/economy/economy.service.ts` | Core business logic for all coin operations |
| `backend/src/economy/dto/economy.dto.ts` | Request DTOs with validation decorators |
| `backend/src/economy/cache.interceptor.ts` | Cache-Control header management |
| `backend/src/economy/economy-exception.filter.ts` | Economy-specific error formatting |
| `backend/src/economy/economy-rate-limiter.guard.ts` | Per-user Redis-based rate limiter |
| `backend/src/economy/apple-notification.service.ts` | Apple App Store server notifications |
| `backend/src/economy/google-play-notification.service.ts` | Google Play real-time developer notifications |
| `backend/src/economy/sanitise-economy.helper.ts` | XSS sanitisation for gift/sticker metadata |
| `backend/src/economy/interfaces/subscription.interface.ts` | Subscription type definitions |
| `backend/src/main.ts` | Swagger setup and global tag registration |