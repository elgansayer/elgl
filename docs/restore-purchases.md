# Restore purchases

## Scope

The subscription surfaces expose a "Restore Purchases" control required by the Apple App Store and Google Play review guidelines. The control is rendered on the plan selection page and the subscription settings page, including while plans are loading or when the plan catalogue fails to load.

## Behaviour

`POST /api/monetisation/restore-purchases` is authenticated and accepts:

- `platform`: one of `ios`, `android` or `stripe` (defaults to `stripe`)
- `receipt_data`: required for `ios` and `android`

The endpoint returns `{ received, status, tier? }`:

- `restored`: the provider confirmed a current entitlement and the user's VIP tier was updated.
- `no_valid_subscription`: the provider returned no current entitlement; no VIP state is changed.

Both outcomes are authoritative server responses. The client never grants entitlement from local state, and a failed or malformed response is reported as a retryable failure.

## Platform verification

- Stripe: the user's active subscription is resolved server-side and mapped to a canonical tier.
- iOS: the signed receipt is validated with the App Store server API before a tier is applied.
- Android: the purchase token is checked with the Play Developer API, expiry is enforced, and the token is claimed for the authenticated account before entitlement is granted. A token already linked to another account is rejected with `403`.

## UX and accessibility

The control exposes a busy state and `aria-busy` while restoring, blocks duplicate activation, and announces the result through a polite live region. Duplicate submissions are also coalesced in the service so a rapid double click cannot submit two restores. Success triggers a subscription refresh on the settings page.

## Verification

- `frontend/src/app/services/restore-purchases.service.spec.ts` covers success, no-purchase, malformed, network failure and concurrent activation paths.
- `frontend/src/app/components/restore-purchases-button/restore-purchases-button.component.spec.ts` covers idle, busy, output and live-region behaviour.
- `frontend/src/app/pages/subscription/subscription-page.component.spec.ts` verifies the control remains available when plans fail to load.
- `backend/src/monetisation/monetisation.service.spec.ts` covers Stripe, iOS and Android restoration, expiry, account ownership and failure outcomes.
- `backend/src/monetisation/monetisation.controller.spec.ts` covers authentication, platform validation and the default platform.

## Rollout and rollback

No database migration is required. Rollback is a normal application revert; restored entitlement changes remain valid because they are persisted by the existing verified VIP update path.
