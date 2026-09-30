# Linked Accounts

The Linked Accounts settings screen is a security surface. A provider is shown as connected only when it exists in the signed-in user's Supabase Auth identities. Application database rows, mock fixtures, or caller-supplied provider names are not authoritative.

## Supported account methods

The UI exposes Google and Apple as linkable OAuth identities. Email is shown as an existing sign-in method when Supabase reports an email identity, but the Linked Accounts page does not add or remove email/password credentials. Facebook and X are not shown because this application does not currently expose configured, tested sign-in flows for those providers.

## Link flow

1. The browser calls `supabase.auth.getUserIdentities()` using the current authenticated session.
2. If the requested Google or Apple identity is already linked, the operation is idempotent and no OAuth redirect is started.
3. Otherwise the browser calls `supabase.auth.linkIdentity()` and returns to `/settings/linked-accounts` after the provider flow.
4. The page reloads identity state from Supabase Auth. It never writes a shadow "linked" flag.

Manual identity linking must be enabled in the Supabase project's Authentication settings. Self-hosted GoTrue deployments use `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true`. If manual linking or the provider is unavailable, the UI reports a retryable failure and does not claim that the account was linked.

## Unlink flow

Supabase requires a signed-in user with at least two identities before an identity can be removed. The page applies the same rule before showing a destructive action and requires explicit confirmation before calling `supabase.auth.unlinkIdentity()` with the exact identity returned by Supabase. Google and Apple can be removed; email/password management remains outside this page.

Repeated mutation clicks are serialized. An unlink provider failure leaves the confirmation state available for retry. A missing provider identity is treated idempotently rather than turning a retry into a destructive error.

## Backend compatibility boundary

`GET /api/users/me/linked-accounts` remains for mixed-version clients. It now projects identities from `supabase.auth.admin.getUserById()` and fails closed when Supabase Auth is unavailable. It no longer reads `linked_accounts` rows or falls back to mock users.

The legacy `POST /api/users/me/linked-accounts/link` and `/unlink` endpoints return `410 Gone`. OAuth identity mutation requires the authenticated end-user browser session and provider redirect, so a server-side database write must never be reported as a successful authentication link. New clients do not call these mutation endpoints.

## Security and privacy

- Provider state comes from Supabase Auth, not request bodies or mutable profile data.
- The browser supports only the configured Google and Apple provider allowlist.
- Unlinking the final sign-in identity is blocked before mutation and is also rejected by Supabase.
- Backend auth lookup failures use a stable `503` response and sanitized log classification; provider errors, tokens, identity payloads, and user IDs are not logged.
- Identity display metadata is owner-only and bounded to 200 characters. The UI currently uses provider/status labels rather than exposing identity metadata.
- No OAuth tokens or identity responses are copied into local storage by this feature.

## Accessibility and failure states

The page provides semantic loading, success, and error announcements; 44px action targets; keyboard-operable link/unlink controls; a visible unlink confirmation; retry for initial identity loading; and wrapping layouts for narrow or high-zoom viewports. Connection state is expressed in text as well as styling.

## Verification

Focused regression suites:

- `frontend/src/app/services/linked-accounts.service.spec.ts`
- `frontend/src/app/pages/settings/linked-accounts/linked-accounts.component.spec.ts`
- `backend/src/linked-accounts/linked-accounts.service.spec.ts`
- `backend/src/linked-accounts/linked-accounts.controller.spec.ts`

Repository CI remains authoritative for frontend/backend lint, type checking, builds, unit tests, E2E checks, and UI governance.

## Rollout and rollback

Enable Supabase manual identity linking and confirm Google/Apple provider redirect URLs include the deployed `/settings/linked-accounts` origin before rolling out the frontend. Deploying the backend first is safe: older clients can still read authoritative identity state but their legacy fake mutation requests fail visibly with `410` instead of creating misleading shadow state.

Rollback of the frontend restores the old client behavior but should not be paired with restoration of shadow identity writes. The backend fail-closed mutation boundary and removal of mock fallback are security hardening and should remain. No schema migration or destructive data rollback is required because `linked_accounts` rows are no longer authoritative and this change does not delete them.
