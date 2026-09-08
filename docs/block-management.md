# Block Management

## Product contract

The Privacy Settings hub links to `/blocks`. That route lazy-loads `BlockManagementComponent`, which displays the authenticated user's blocked accounts and allows an individual account to be unblocked.

The page distinguishes four states rather than treating failures as empty data:

- loading: skeleton content is exposed with `aria-busy`;
- unavailable: the blocked-users request failed and a Retry action is shown;
- empty: the authenticated request succeeded with no blocked users;
- populated: each blocked account is shown with available profile/language metadata and an Unblock action.

Unblock is a confirmed mutation. While a request is in flight the affected action is disabled and marked busy. A failed unblock leaves the account in the list and exposes an alert so a retry cannot be mistaken for success. Duplicate concurrent unblocks for the same account are suppressed.

## API and authorization

The frontend uses the existing authenticated endpoints:

- `GET /blocks` to load blocked account details;
- `DELETE /blocks/:userId` to unblock one account.

Bearer credentials come from `AuthService`; the feature does not read authentication tokens directly from browser storage. Missing credentials fail closed without issuing an unauthenticated request. User IDs are URL-encoded before they are placed in the delete path.

No schema or migration changes are required. Block persistence, authorization, retention and cascade behavior remain owned by the existing backend Blocks module and database policies.

## Accessibility and privacy

The page has a labelled main landmark, native Spartan buttons, 44px touch targets, contextual accessible names, visible loading/error states, and logical spacing. User-authored names and language text use `dir="auto"`; layout does not depend on physical left/right utilities. Avatar images are decorative because the adjacent text already identifies the account.

The frontend does not log blocked-account identities, access tokens, or mutation failures. Error feedback is intentionally generic.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/pages/block-management/block-management.component.spec.ts`;
- `frontend/src/app/services/blocked-users.service.spec.ts`;
- `frontend/src/app/routes/block-management-route.contract.spec.ts`.

Run the frontend unit suite, static analysis and production build before rollout. Repository CI remains authoritative for the complete integration gate.

## Rollout and rollback

This change is backward-compatible with the existing Blocks API and requires no data migration. Rollback is a normal code revert. A rollback must not restore fake-success unblock behavior or direct reads of authentication credentials from browser storage.
