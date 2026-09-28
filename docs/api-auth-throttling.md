# API Authentication Throttling -- Configuration

## Overview

Sensitive authentication endpoints are protected with `@nestjs/throttler` to limit how
often a single client can attempt password changes, two-factor authentication flows,
password resets, device transfer, and destructive account operations. This reduces the
risk of credential brute forcing, token guessing, and account abuse.

## Global Configuration

`@nestjs/throttler` is registered in `backend/src/app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  {
    ttl: 60000,
    limit: 10,
  },
]),
```

The `ThrottlerGuard` is registered as a global `APP_GUARD`, so every route in the API
inherits the default limit of 10 requests per 60 seconds. Individual endpoints tighten
this default with the `@Throttle()` decorator using the `default` named throttler.

## Endpoint Limits

The following table lists the limits applied to sensitive authentication and account
lifecycle endpoints. Values are expressed as `limit` requests per `ttl` milliseconds.

| Endpoint | Method | Limit | Window (ms) | Rationale |
|---|---|---|---|---|
| `/auth/change-password` | POST | 3 | 60000 | Password change attempts |
| `/auth/two-factor/enable` | POST | 5 | 300000 | 2FA setup attempts |
| `/auth/two-factor/verify` | POST | 5 | 60000 | 2FA token guessing |
| `/auth/two-factor/disable` | POST | 3 | 60000 | 2FA removal attempts |
| `/auth/transfer/generate` | POST | 5 | 60000 | Device transfer link generation |
| `/auth/transfer/consume` | POST | 5 | 60000 | Transfer token consumption |
| `/auth/transfer/swap` | POST | 5 | 60000 | Transfer session swap |
| `/auth/request-password-reset` | POST | 3 | 300000 | Password reset request spam |
| `/auth/reset-password` | POST | 3 | 300000 | Password reset token guessing |
| `/two-factor/enable` | POST | 3 | 60000 | 2FA setup attempts |
| `/two-factor/verify` | POST | 5 | 60000 | 2FA token guessing |
| `/two-factor/disable` | POST | 3 | 60000 | 2FA removal attempts |
| `/generate-device-link` | POST | 3 | 60000 | Device link generation |
| `/transfer/generate` | POST | 3 | 60000 | Device transfer link generation |
| `/transfer/consume` | GET/POST | 10 | 60000 | Transfer token consumption |
| `/transfer/swap` | POST | 5 | 60000 | Transfer session swap |
| `/users/me` | DELETE | 3 | 60000 | Account deletion scheduling |
| `/users/me/permanent` | DELETE | 2 | 300000 | Irreversible account deletion |
| `/users/me/restore` | POST | 3 | 60000 | Account deletion cancellation |

Read-only status endpoints (for example `GET /auth/two-factor/status` and
`GET /two-factor/status`) are intentionally left at the global default because they do
not mutate account state.

## Adding a New Sensitive Endpoint

To protect a new sensitive endpoint, decorate the handler with `@Throttle()` using the
`default` named throttler:

```typescript
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 3, ttl: 60000 } })
@Post('sensitive-action')
async sensitiveAction(): Promise<void> {
  // handler
}
```

Choose a limit that allows legitimate repeated use while blocking scripted abuse.
Irreversible operations, such as permanent account deletion, should use a stricter
limit with a longer window.

## Testing

Unit tests assert the throttler metadata directly on each handler so that an accidental
removal or duplication of the `@Throttle()` decorator fails CI:

- `backend/src/auth/auth.controller.spec.ts`
- `backend/src/password-reset/password-reset.controller.spec.ts`
- `backend/src/users/users.controller.spec.ts`

The metadata keys used by `@nestjs/throttler` for the `default` throttler are
`THROTTLER:LIMITdefault` and `THROTTLER:TTLdefault`.

## Related Files

| File | Purpose |
|---|---|
| `backend/src/app.module.ts` | Global `ThrottlerModule` and `ThrottlerGuard` registration |
| `backend/src/auth/auth.controller.ts` | Password change, 2FA and device transfer endpoints |
| `backend/src/password-reset/password-reset.controller.ts` | Password reset endpoints |
| `backend/src/two-factor/two-factor.controller.ts` | 2FA management endpoints |
| `backend/src/users/users.controller.ts` | Account lifecycle endpoints |
| `backend/src/transfer/transfer.controller.ts` | Device transfer endpoints |
| `backend/src/users/device-link.controller.ts` | Device link generation endpoint |
