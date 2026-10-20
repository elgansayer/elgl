# Profile visibility

## Contract

Users can choose who may open their profile from Privacy settings:

- `everyone`: any authenticated user may open the profile.
- `vips_only`: only the profile owner and authenticated VIP users may open the profile.
- `hidden`: only the profile owner may open the profile.

The persisted value is `users.profile_visibility`. The existing database constraint accepts only `everyone`, `vips_only`, and `hidden`, with `everyone` as the backwards-compatible default.

## API and authorization

The Privacy settings UI reads `GET /api/users/me/privacy-settings` and writes `PATCH /api/users/me/privacy` with a single validated `profile_visibility` value. Both routes are protected by `SupabaseAuthGuard`. The public profile route remains authoritative for enforcement: owners can always read their own profile, `hidden` rejects other viewers, and `vips_only` checks the requesting user's server-side VIP entitlement before returning profile data.

The browser never decides whether another user is allowed to view a profile. UI state is only a preference editor.

## Failure behaviour

Loading or saving the preference is fail-closed. The dedicated frontend service does not replace API failures with mock success. A failed save rolls the visible selection back to the last persisted value and exposes an accessible retryable error state. Repeated changes are suppressed while a save is in flight.

No profile data, access token, or viewer identity is logged by the profile-visibility UI or service.

## Accessibility and localisation

The three mutually exclusive choices use the repository-owned Spartan radio group so keyboard and selection semantics are primitive-owned. The group is labelled by a visible heading, save/load state is announced with status or alert semantics, controls meet the existing touch-target baseline, long translated descriptions wrap, and layout uses direction-neutral styling for RTL and high zoom.

All UI copy is referenced by translation keys under `privacy.profileVisibility.*`; the normal application translation fallback handles locales that have not yet received a curated string.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/services/profile-visibility.service.spec.ts`
- `frontend/src/app/pages/settings/privacy-settings/privacy-settings.component.spec.ts`
- existing backend users controller/service privacy tests

Standard frontend unit, static-analysis, production-build, accessibility/design-governance, backend, and repository checks remain authoritative in CI.

## Rollout and rollback

No new migration is required because the constrained `profile_visibility` column already exists. Deploy the frontend and backend together under the existing API contract. Rollback is a normal code revert; persisted values remain valid and older clients continue to receive the database default or their previously selected value.
