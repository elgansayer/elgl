# Password recovery

Password recovery is implemented by the dedicated NestJS `PasswordResetModule`. The generic `AuthService` does not own recovery endpoints; keeping a single backend path avoids route drift and prevents an alternate implementation from bypassing the email and one-time-token controls.

## Flow

1. The Angular `/forgot-password` screen sends a normalized email address to `POST /api/auth/request-password-reset`.
2. The endpoint is throttled and always returns the same public success response. This prevents callers from using response differences to enumerate registered accounts.
3. `PasswordResetService` finds the account through the Supabase Admin API, invalidates any outstanding recovery token for that account, generates a cryptographically random 32-byte token, and persists only its SHA-256 digest in `password_reset_tokens`.
4. `EmailService` sends the raw token only in an HTTPS/HTTP reset link. New mail points to the canonical `/reset-password` route. The older `/forgot-password?token=...` UI remains compatible with already-issued links during rollout.
5. `POST /api/auth/reset-password` accepts only the 64-character hexadecimal token format and a password between 8 and 128 characters. The backend atomically claims an unused, unexpired token digest before updating the Supabase Auth password.
6. A claimed token is never made reusable if the downstream password update fails. The user must request a new link.

Reset links expire after 30 minutes and are single-use.

## Security and privacy

- Request and reset endpoints are rate limited.
- Email addresses are trimmed, normalized to lowercase, validated, and bounded to 254 characters.
- Reset tokens are generated with `crypto.randomBytes(32)` and only their SHA-256 digest is stored.
- Reset tokens are validated at the HTTP and email-dispatch boundaries.
- `EmailService` accepts only HTTP(S) frontend destinations and does not log the recipient address or reset credential.
- The request endpoint deliberately does not disclose whether an email is registered or whether mail/storage infrastructure failed.
- Provider/database failures are logged only as operation classifications; user email addresses, reset tokens, SMTP credentials, and provider error payloads must not be logged.
- Browser forms use password-manager autocomplete hints, bounded inputs, busy states, and live status/error regions.

## Failure behaviour and observability

A failure while locating an account, persisting a token, or dispatching mail is recorded in server logs without PII. The public request response remains generic. If email dispatch fails after token creation, the token is invalidated so an undelivered credential cannot later become usable.

An invalid, expired, malformed, or already-used token is rejected without changing the password. A Supabase Auth failure after token claim returns a generic reset failure and keeps the token consumed.

Operational alerts should track rates of these existing log messages rather than adding email addresses or tokens to telemetry:

- `Failed to query accounts for password reset`
- `Failed to invalidate previous password reset tokens`
- `Failed to persist password reset token`
- `Failed to dispatch password reset email`
- `Failed to update password after reset token claim`

## Verification

At minimum, changes to this flow should run the password-reset, email, and auth backend unit suites and the forgot/reset password Angular component suites. Repository CI remains the authoritative integration check.

Manual smoke verification:

1. Request a reset for a known account and confirm the UI shows the same generic success copy used for an unknown account.
2. Confirm the delivered link targets `/reset-password` and contains a 64-character hexadecimal token.
3. Reset the password once and verify a second use of the same link fails.
4. Request a second link and verify the previous outstanding link no longer works.
5. Verify malformed links do not issue a reset request from the browser.
6. Verify SMTP/database failures do not expose recipient addresses or tokens in logs or HTTP responses.

## Rollout and rollback

This change is API-compatible with the existing request and reset endpoints and requires no database migration. Existing 64-character recovery tokens remain valid until their normal 30-minute expiry, including links that still target `/forgot-password`.

Rollback is a normal application revert. No data rollback is required. If the canonical `/reset-password` link change is reverted, links already delivered to users continue to work because that route already exists. Do not roll back by re-enabling the duplicate recovery methods in `backend/src/auth/auth.service.ts`; the dedicated `PasswordResetModule` is the authoritative recovery boundary.
