# Online and VIP status privacy controls

Issue #776 adds two account-level privacy controls without changing the underlying presence tracking or subscription entitlement model.

## Behaviour

- `privacy_hide_online_status = false` by default. When enabled, member-facing profile APIs omit `last_active_at` for viewers other than the account owner. Internal activity tracking continues so security, streak, administration, and abuse controls are not degraded.
- `privacy_hide_vip_status = false` by default. When enabled, member-facing profile APIs expose the member as non-VIP and omit the public tier value, while the authenticated owner still receives the real entitlement through `/users/me`. Subscription authorization therefore continues to use the canonical persisted entitlement rather than a presentation flag.
- The profile detail UI also suppresses its VIP badge when `privacy_hide_vip_status` is set.
- The Privacy Settings screen loads the persisted controls before enabling interaction. Mutations are optimistic for responsiveness, but a failed request restores the previous value and exposes an accessible error state with a retry action.
- Repeating either mutation with the same boolean is idempotent.

## API contract

The controls reuse existing authenticated user endpoints rather than introducing a parallel settings store:

| Operation | Endpoint | Payload |
| --- | --- | --- |
| Read both controls | `GET /users/me` | none |
| Hide/show online status | `PATCH /users/me` | `{ "privacy_hide_online_status": boolean }` |
| Hide/show VIP status | `PATCH /users/me/privacy` | `{ "privacy_hide_vip_status": boolean }` |

`PATCH /users/me` already validates `privacy_hide_online_status` through `UpdateProfileDto`. `PATCH /users/me/privacy` validates `privacy_hide_vip_status` through `PrivacySettingsDto`. All endpoints remain protected by the existing Supabase authentication guard.

For `GET /users/:id` and `GET /users/:id/stats`, the controller applies member-facing masking only when the requester is not the profile owner. This avoids using presentation privacy as an authorization signal and prevents clients from recovering hidden state from the canonical profile response.

## Data model and migration

`supabase/migrations/20260820220100_add_status_privacy_controls.sql` ensures both boolean columns exist with `NOT NULL DEFAULT false`. It uses `ADD COLUMN IF NOT EXISTS`, so it is safe to replay and safe in environments where an earlier schema bootstrap already created the fields. No index is needed because these values are read with an already-selected user row rather than used for collection scans.

The controls have the same retention lifecycle as the user record. Account deletion therefore removes the values with the rest of the account; no additional personal-data store or retention job is introduced.

## Accessibility and failure handling

The settings use native checkbox controls, remain keyboard focusable, provide descriptive text through `aria-describedby`, expose loading with `role="status"`, expose mutation/load failures with `role="alert"`, and announce successful persistence through an `aria-live` status region. While one setting is being saved both controls are disabled, avoiding conflicting concurrent writes from the screen.

The dedicated `PrivacyStatusService` deliberately does not substitute mock data or swallow HTTP failures. Privacy settings must fail visibly rather than presenting a successful but unpersisted state.

## Observability and privacy

No tokens, profile contents, entitlement data, activity timestamps, or changed values are added to application logs. Existing HTTP request/error telemetry can correlate failed authenticated requests. The UI distinguishes load and persistence failure states without exposing backend details.

## Rollout

1. Apply the Supabase migration.
2. Deploy the backend validation/member-masking changes.
3. Deploy the frontend service and Privacy Settings UI.
4. Verify a test member can enable both controls, reload the page, and see the persisted values.
5. From a second account, verify the target profile no longer exposes `last_active_at` or a VIP badge/tier while the target account still receives its actual VIP entitlement from `/users/me`.

Mixed-version deployment is safe: the columns default to `false`; older clients ignore them; the new frontend uses existing authenticated endpoints; and the backend treats unset/false values as the historical public behaviour.

## Rollback

Rollback the frontend and backend first. The two columns can remain in place safely because their defaults preserve historical behaviour and older application versions ignore them. If schema removal is later required, first set both columns to `false`, confirm no deployed application reads them, then remove them in a separate migration. Do not drop the columns before the application rollback.

## Verification

Targeted automated coverage includes:

- DTO validation for `privacy_hide_vip_status`.
- HTTP contract/error propagation for `PrivacyStatusService`.
- Privacy Settings loading, persistence, rollback, retry, keyboard, and screen-reader behavior.
- Server-side owner-versus-other-member masking for profile and stats endpoints.
- Profile-detail VIP badge suppression.

The repository CI remains the source of truth for lint, type checking, unit tests, migration checks, translation safety, and UI design coverage.
