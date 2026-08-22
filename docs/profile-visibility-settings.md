# Profile visibility settings

Issue #1099 exposes the existing `users.profile_visibility` privacy contract in the Privacy Settings screen.

## Behaviour

Authenticated users can choose one of three persisted values:

- `everyone`: any authenticated member may open the profile.
- `vips_only`: only VIP members and the profile owner may open the profile.
- `hidden`: only the profile owner may open the profile.

The database column and validation contract already exist. `PATCH /users/me/privacy` remains the authoritative mutation endpoint and `GET /users/me/privacy-settings` remains the authoritative read endpoint. The existing `GET /users/:id` controller enforces the selected visibility before returning another member's profile.

The Privacy Settings UI reads the server value before enabling the control. Mutations are optimistic, but only one mutation may be in flight at a time. A failed request restores the previous selection and exposes a retryable error instead of substituting mock privacy state. A successful HTTP response is accepted only when it echoes the requested persisted value.

## Security and privacy

`ProfileVisibilityService` deliberately does not use the legacy mock-data fallbacks in `UserService`. Privacy state must fail closed when the API is unavailable or malformed. Requests require an access token and send only the selected enum value; no profile content or credentials are logged.

This setting controls profile access. It does not delete the account, erase historical messages, or change block relationships. Existing block and safety rules continue to apply independently.

## Accessibility

The three choices are rendered as native radio inputs inside a labelled `fieldset`, preserving keyboard navigation and platform accessibility semantics. Loading and saving disable the group, `aria-busy` exposes transient work, errors use an alert region, and success is announced through a live status region. The layout uses logical spacing and wraps at narrow widths/high zoom.

## Failure handling

- Missing authentication: no API request is sent and the UI shows the load failure state.
- Invalid or missing server enum: the client rejects the response rather than defaulting to `everyone`.
- Network/server failure while loading: choices stay disabled until the user retries.
- Network/server failure while saving: the optimistic selection is rolled back.
- Conflicting repeated click while a save is active: ignored until the current mutation settles.

## Verification

Focused Vitest coverage verifies the authenticated HTTP contract, strict enum validation, read-back verification, HTTP failure propagation, initial state loading, accessible radio semantics, successful persistence, duplicate suppression, rollback, and retryable load failures.

Repository CI remains authoritative for the full frontend unit, static-analysis, build, translation-safety, design-governance, and E2E suites.

## Rollout and rollback

No database migration is required because `20260807000000_add_profile_visibility_to_users.sql` already provides the retry-safe column/default/check constraint and existing backend endpoints already validate and enforce the enum.

Deploy the frontend normally. To roll back, revert this PR; the persisted `profile_visibility` values and backend enforcement remain backward-compatible with older clients. Do not remove the database constraint or backend authorization check during rollback.
