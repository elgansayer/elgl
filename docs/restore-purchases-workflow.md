# Restore purchases workflow

## Scope

The product exposes an authenticated `POST /monetisation/restore-purchases` backend boundary for Stripe, Apple App Store and Google Play purchase verification. The frontend restore control is available from subscription surfaces and uses that server-authoritative boundary; the browser never grants VIP status itself.

This document defines the shared restore workflow and records the Android purchase-ownership hardening completed for issue #1475.

## User flow

1. The learner selects **Restore purchases** from a subscription surface.
2. The shared `RestorePurchasesService` submits one authenticated restore request.
3. While that request is in flight, further activations reuse the same promise and do not create duplicate restore requests.
4. The backend verifies the provider purchase history and returns either `restored` or `no_valid_subscription`.
5. A successful restore emits a `restored` event from the shared button. The My Subscription page reloads subscription details and billing history so the newly restored entitlement is visible without a manual page refresh.
6. A no-subscription result remains a normal, non-destructive outcome. Provider/network/malformed-response failures are reported as retryable failures.

For Google Play, the verified purchase token is account-bound. An unclaimed active token is associated with the authenticated account before entitlement is restored. A token already associated with that same account may be restored again idempotently. A token associated with a different account is rejected and must never grant VIP status to the caller.

## State and retry behaviour

`RestorePurchasesService` owns the request lifecycle through `isRestoring` and `lastRestoreResult` signals. The latest completed result remains available while a later attempt starts, avoiding a transient false-empty state. Concurrent activations are deduplicated client-side. The backend remains authoritative and must also keep restoration idempotent because a browser can retry after an ambiguous transport failure.

The client only treats a response as success when `received === true` and `status === "restored"`. Unknown or malformed statuses fail closed. `no_valid_subscription` is represented separately from provider/network failure so the UI does not claim that an outage means the learner has no purchase history.

## Security and privacy

Purchase receipts and provider tokens are sent only to the authenticated monetisation API. They are not persisted in local storage, drafts, analytics or client logs by this workflow. The client never derives or writes `is_vip`/`vip_tier`; entitlement changes remain server-controlled after provider verification.

Google Play purchase tokens are credentials as well as ownership identifiers. Restore diagnostics must not log the token, the current account ID, or the existing owner ID. Cross-account token reuse is rejected before any VIP mutation. Missing and expired Google Play purchases are logged only with sanitized state descriptions.

Receipt bodies must not be included in error messages, telemetry or support diagnostics. Provider responses are treated as untrusted input. A successful restore result may expose the restored tier when the backend supplies it, but never a receipt or purchase token.

## Accessibility

The restore control is disabled and marked busy while restoration is running. The progress spinner is decorative. The latest completed result is mirrored into a polite screen-reader live region in addition to the existing toast notification, and the control retains the standard Spartan keyboard/focus behaviour.

## Verification

Frontend regression coverage verifies:

- Stripe success and restored-tier propagation;
- iOS receipt normalization;
- no-valid-subscription handling;
- malformed response and network failure handling;
- concurrent restore deduplication;
- busy-state accessibility;
- success-only `restored` event emission; and
- live-region result announcement.

Backend ownership regression coverage verifies:

- an unclaimed active Google Play token is stored for the authenticated account before entitlement is restored;
- a token already owned by the authenticated account restores idempotently without a duplicate store;
- a token owned by another account is rejected before any VIP mutation; and
- missing, expired, and cross-account restore diagnostics do not expose provider purchase tokens or user identifiers.

The repository CI remains authoritative for the complete backend/frontend unit, lint, build and design-system governance suites.

## Rollout and rollback

The ownership hardening introduces no schema, provider credential or route change. It is safe to deploy with existing clients because successful and no-subscription response shapes remain unchanged.

Rollback is a normal code revert, but restoring the former cross-account entitlement behavior is not considered a safe rollback. If a provider integration must be disabled operationally, prefer returning a retryable unavailable state while retaining account-ownership enforcement.
