# GDPR account lifecycle status

## Scope

The Personal Data Collection hub supports authenticated archive requests and a 30-day account-deletion grace period. This document covers the lifecycle hardening added for issue #1457 so those operations remain correct across reloads, devices, retries, and mixed-version clients.

## Authoritative state

The browser does not treat local component state as authoritative for account deletion. On entry to the GDPR hub it requests `GET /api/privacy/status`, which is protected by `SupabaseAuthGuard` and returns only the requesting account's deletion state:

```json
{
  "deletion": {
    "pending": true,
    "scheduled_for": "2026-09-26T04:00:00.000Z",
    "requested_at": "2026-08-27T04:00:00.000Z"
  }
}
```

The endpoint exposes no profile, email, location, archive contents, signed URLs, or provider diagnostics. Provider/database failures return a stable service-unavailable response rather than inventing a non-pending state.

The Angular client validates the response shape and timestamps before accepting it. A failed status load leaves destructive state unchanged, shows a retryable error, and does not block archive requests. A server-confirmed delete or cancel invalidates any older in-flight status request so a stale response cannot undo the just-completed action.

## Deletion idempotency

A deletion request starts a 30-day grace period. Retrying the request while `is_deletion_pending = true` must not move the deadline forward. Migration `20260827050000_harden_gdpr_deletion_idempotency.sql` installs a database trigger that preserves the original `deletion_requested_at` and `scheduled_for_deletion_at` values for repeated pending-to-pending updates.

The migration also repairs legacy pending rows that are missing either timestamp and adds a check requiring every pending deletion to have a scheduled deadline. Cancelling deletion is unaffected because the preservation trigger only applies while both the old and new row are pending. A later fresh deletion request after cancellation therefore receives a new 30-day grace period.

This database boundary intentionally protects older application versions too; correctness does not depend on every client or backend instance being upgraded at the same moment.

## Security and privacy

- All lifecycle endpoints remain authenticated through the controller-level Supabase guard.
- The backend derives the account identifier from the authenticated user; the browser cannot supply another user ID.
- Status responses contain only lifecycle booleans/timestamps needed by the UI.
- Provider errors and user identifiers are not included in lifecycle warning logs.
- Repeated deletion requests cannot extend the grace period and delay automated deletion.
- The existing delete flow still immediately hides the profile from discovery and clears precise/mock location data.
- The existing cancel flow remains server-confirmed before the UI reports success.

## Failure handling

If lifecycle status cannot be loaded, the hub exposes an accessible retry action and does not fabricate success. If scheduling or cancellation fails, the existing mutation path continues to fail closed. Status lookup is deliberately independent from archive generation, so an availability problem in one operation does not create a false result for the other.

Malformed legacy timestamps never hide the fact that deletion is pending; the backend returns `pending: true` with a null malformed timestamp. The UI only relies on the authoritative pending boolean for whether to offer cancellation.

## Verification

Deployment verification should confirm:

1. a clean Supabase migration replay succeeds;
2. a first delete request schedules approximately 30 days ahead;
3. a repeated delete request while pending leaves the original deadline unchanged;
4. reloading the GDPR hub restores the pending state and offers cancellation;
5. cancellation clears the pending state and a subsequent reload shows deletion as inactive;
6. a new deletion request after cancellation receives a new grace deadline;
7. an authenticated user cannot query another user's status;
8. lifecycle provider failures produce a retryable error rather than a false non-pending result.

Focused backend tests cover lifecycle reads and fail-closed behavior. Angular tests cover cross-session state rehydration, retry handling, stale-request protection through mutations, and existing archive/delete/cancel behavior. The database migration is exercised by the repository's clean Supabase replay checks.

## Rollout and rollback

Deploy the migration before or with the backend/frontend release. It is safe with older application versions because it only prevents an already-pending deletion deadline from being extended.

If application code must be rolled back, keep the idempotency trigger and pending-deletion check in place; removing them would reintroduce deadline extension on retries. The new read-only status endpoint may be removed independently once no deployed client depends on it, although keeping it is harmless for older clients.
