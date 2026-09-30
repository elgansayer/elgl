# Presence privacy settings

Issue #1463 adds two account-scoped privacy controls to the Privacy Settings hub:

- **Hide online status** persists `privacy_hide_online_status`.
- **Hide VIP status** persists `privacy_hide_vip_status`.

Both values already exist on the user profile schema and are validated by the authenticated profile-update contract. This change exposes those persisted settings through a focused Angular service instead of writing directly to browser storage or Supabase from the UI.

## API and security boundary

The browser reads the current flags from the authenticated `GET /users/me` profile response and persists only the changed flag through `PATCH /users/me`. Both calls require the existing access token. The client never treats a failed save as success and rolls an optimistic toggle back when the request fails.

The privacy flags are presentation/privacy preferences. They must not be used as entitlement inputs: paid-feature authorization continues to use the authoritative server-side `is_vip`/tier state. Existing discovery recommendation ranking already treats `privacy_hide_online_status` as a request not to use recent activity as a recommendation signal.

## UX and accessibility

The controls use the repository-owned Spartan checkbox primitive inside a minimum 44 CSS-pixel labelled row. The visible translated label is also the checkbox accessible name. While one mutation is pending both toggles are disabled to avoid conflicting concurrent writes, the section exposes `aria-busy`, and success/failure is announced through status/alert text. Long translations may wrap without reducing the hit area.

Loading failures show an explicit retry action. Save failures preserve the server-backed value in the UI by rolling back the optimistic change.

## Validation

Focused coverage lives in:

- `frontend/src/app/services/presence-privacy.service.spec.ts`
- `frontend/src/app/pages/settings/privacy-settings/privacy-settings.presence-privacy.spec.ts`

The tests cover authenticated reads and writes, default values, unauthorized access, persistence failures, independent flags, optimistic rollback, and concurrent-mutation suppression. The normal frontend unit, static-analysis, production-build, translation, accessibility/design-governance, and repository CI jobs remain authoritative before merge.

## Rollout and rollback

No migration is required because both profile columns already exist. Mixed-version clients remain compatible: older clients ignore the fields and newer clients read their persisted values.

Rollback is a normal revert of the frontend change. Persisted boolean values may remain in the profile row and can safely be ignored by an older client. Do not roll back by deleting or repurposing the existing privacy columns.
