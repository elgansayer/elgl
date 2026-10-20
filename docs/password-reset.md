# Password recovery

Issue #1439 is implemented by the existing Angular forgot-password flow and NestJS password-reset boundary. This document records the production contract and the regression checks that keep the flow safe.

## Product flow

`/forgot-password` accepts an email address and submits it through `AuthService.requestPasswordReset()` to `POST /api/auth/request-password-reset`. The public response is intentionally identical whether or not an account exists. When a user follows the one-time link, the same page accepts the `token` query parameter and submits the replacement password through `POST /api/auth/reset-password`.

The frontend keeps both submissions single-flight by disabling the Spartan touch-sized submit controls while a request is pending. Email syntax and the eight-character minimum password rule are validated before submission. Backend DTO validation remains authoritative.

## Security and privacy

Both public reset endpoints are limited to three requests per five-minute throttling window. Account lookup is bounded and the request endpoint never reveals whether a supplied email address exists.

Reset tokens are generated from 32 cryptographically random bytes. Only a SHA-256 digest is stored in `password_reset_tokens`; the raw token is sent to the recipient. Tokens expire after 30 minutes and are claimed through a conditional update that requires `used = false` and a future expiry. A newer request invalidates earlier unused tokens for the same user. If email delivery fails, the newly generated token is invalidated before the request completes.

Password-reset logs must not contain email addresses, raw tokens, password values, SMTP credentials, or reset URLs. The email service records only a generic successful-dispatch message.

## Email delivery

`EmailService` uses the configured SMTP transport (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`) and sender metadata (`MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`). `FRONTEND_URL` is the public application origin used to create the one-time reset link.

Production deployments must supply real SMTP settings and an HTTPS `FRONTEND_URL`. Credentials belong in the runtime secret store and must not be committed to the repository.

## Failure behaviour

Unknown email addresses are treated as a successful request so the endpoint cannot be used for account enumeration. Account-directory, token-persistence, and email-provider failures are recorded with sanitised server-side messages while the request endpoint retains its generic public response.

An invalid, expired, or already-used reset token is rejected. Failed password updates do not make a token reusable because it has already been claimed; the user must request a new link. This is a deliberate fail-closed choice that prevents concurrent reuse of a reset credential.

## Accessibility

The Angular flow uses visible labels, native email/password inputs, reactive form validation, and Spartan touch-sized submit controls. Pending state disables duplicate submissions. Success and error copy is rendered as text and does not rely on colour alone.

## Verification

The dependency-free contract can be run from the repository root:

```bash
node --test scripts/password-reset-contract.test.mjs
```

It verifies the cross-layer route, frontend API, throttling, account-enumeration protection, validation, token generation/hash/expiry/single-use rules, SMTP dispatch, and privacy-safe logging contract. Normal frontend and backend unit, lint, build, and E2E jobs remain authoritative for behavioural integration.

## Rollout and rollback

No schema or API migration is introduced by the contract. Deploy password-reset changes through the normal backend/frontend rollout and verify SMTP configuration before production traffic is enabled. A rollback is a normal application revert; existing hashed reset-token rows can remain until their normal expiry/cleanup path removes them.
