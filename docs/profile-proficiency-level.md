# Profile proficiency level

## Product contract

`users.proficiency_level` stores an optional CEFR self/diagnostic level for the learner profile. The canonical persisted and API values are uppercase `A1`, `A2`, `B1`, `B2`, `C1`, and `C2`, matching the standard CEFR notation used by the profile editor, discovery filters, proficiency service, and diagnostic onboarding.

The value is nullable. A missing value means that no proficiency level has been selected or established yet; application code must not interpret `NULL` as a particular level.

## Data model and compatibility

The original `20260807000000_add_proficiency_level_to_users.sql` migration introduced the nullable two-character column and a six-value check constraint. The forward migration `20260826140000_harden_proficiency_level_contract.sql` converges older/mixed deployments without rewriting applied migration history:

1. remove the old constraint inside the migration transaction;
2. normalize supported lower/mixed-case values to canonical uppercase;
3. fail the migration if any unsupported persisted value remains, rather than deleting or guessing learner data;
4. restore and validate the exact six-value constraint; and
5. retain `NULL` as a valid state.

The migration is safe to retry after a successful application because normalization is idempotent and the constraint is recreated deterministically.

## API and UI behavior

`PATCH /users/me` validates `proficiency_level` against the six canonical CEFR values. The authenticated profile UI loads the saved value, displays it on the profile when present, exposes all six levels in edit mode, and persists the selected value through the existing typed profile-update path. Diagnostic onboarding may also assign the same canonical field through its server-authoritative scoring flow.

Discovery and learning features must treat the field as optional and must not infer a level for users with no saved value.

## Security and privacy

Proficiency is account profile data. Existing profile authentication, profile-visibility rules, discovery privacy filters, and Supabase row-level security remain authoritative. The migration does not add a public endpoint or log individual proficiency values. Migration failure reports only that unsupported values exist, not which users or values caused the failure.

## Failure handling and observability

An unexpected persisted value causes the migration to fail with PostgreSQL check-violation SQLSTATE `23514`. This deliberately stops rollout before a malformed value can be truncated, discarded, or silently mapped to another level. Operators should repair the affected rows using an explicitly reviewed data correction and rerun the migration.

Normal API validation rejects unsupported values before persistence. Database validation remains the final integrity boundary for stale or alternate clients.

## Verification

Automated coverage includes:

- `backend/src/users/dto/update-profile.dto.spec.ts` for API validation;
- `backend/src/users/proficiency-level.spec.ts` for the canonical TypeScript contract;
- `backend/src/database/migrations/20260826140000_harden_proficiency_level_contract.spec.ts` for migration normalization, fail-closed behavior, nullability, and the constraint; and
- `frontend/src/app/components/profile/profile.component.spec.ts` for loading/displaying and saving the profile level.

A production rollout should additionally run the repository clean Supabase migration replay and the normal backend/frontend CI suites.

## Rollout and rollback

Apply the forward migration before or with the backend deployment. Existing current clients already send uppercase values, so no coordinated client cutover is required.

If rollout fails because legacy data is invalid, do not drop the constraint or coerce arbitrary values. Repair the data explicitly and rerun. After successful deployment, application code can be rolled back without changing stored data; the stricter database constraint should normally remain because it is compatible with the existing API/UI contract.
