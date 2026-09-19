# Profile visitor logs

## Purpose

`Who Viewed Me` is implemented through one canonical privacy boundary: the NestJS `profile-visits` module. Profile-view identity is an entitlement, so neither Angular state nor a direct Supabase query is trusted to decide whether names, user IDs, avatars, bios, or language metadata may be returned.

## Canonical API

### `POST /profile-visits/:viewedId`

The authenticated viewer is taken from `SupabaseAuthGuard`; the request does not send a viewer ID or VIP flag.

Before a row is written the service verifies, server-side, that:

- the viewer is not viewing their own profile;
- the viewer account is active;
- a VIP viewer is not using incognito profile visits;
- the viewed profile exists, is active, is not deletion-pending, and is not hidden;
- neither user has blocked the other.

Eligible visits are persisted with a UTC `visit_day`. A unique database index on `(visitor_id, viewed_id, visit_day)` makes refreshes and concurrent retries idempotent. A unique-key conflict is returned as an ignored `duplicate` and does not emit another `profile.view` notification.

The response is deliberately small:

```json
{
  "recorded": true,
  "ignored": false,
  "visit_id": "uuid"
}
```

Ignored results return a reason from `self`, `incognito`, `blocked`, `unavailable`, or `duplicate`. These reasons describe the caller's own write attempt and are not used by the visitor-list UI to infer another user's private state.

### `GET /profile-visits/my-visitors?limit=20&offset=0`

The service loads the owner's entitlement directly from the users table and fails closed if it cannot verify it. `limit` is bounded to 1-50 and `offset` is clamped to zero or greater. The response includes `has_more` and `next_offset` so clients do not rely on an unpageable hard limit.

VIP owners receive visitor identity. Non-VIP owners receive the same visit timestamps/count shape but every identity-bearing field is replaced server-side before the response leaves NestJS. Angular uses the returned `identity_visible` flag only to choose presentation; it does not perform the entitlement decision.

Rows for visitors that are now hidden, deleted, or deletion-pending are filtered even before database cleanup completes.

## Frontend integration

`ProfileVisitorsComponent` consumes only `ProfileVisitsService` and `/profile-visits/my-visitors`. It has explicit loading, empty, error/retry, masked-upgrade, and paginated states. It does not fall back to `MOCK_VISITORS` or render a profile link for masked visitors.

`UserDetailComponent` records a visit only after a profile has loaded successfully. It suppresses repeated attempts for the same profile in one component lifetime and never sends a self-view. Visitor-log failure is non-blocking for profile rendering; a later reload may retry safely because the database dedupe key is authoritative.

## Legacy endpoint

`GET /users/me/visitors` is deprecated. Existing clients may still call it temporarily, but `LegacyProfileVisitorsPrivacyInterceptor` re-verifies VIP entitlement directly from the database and masks the legacy response for non-VIP callers. The endpoint emits `Deprecation: true` and a successor `Link` header pointing to `/profile-visits/my-visitors`.

This compatibility interceptor is intentionally fail-closed: if entitlement cannot be verified, no visitor payload is returned.

Remove the legacy controller route and interceptor once supported clients have migrated to the canonical endpoint.

## Database privacy and lifecycle

Migration `20260820201500_harden_profile_visit_privacy.sql` applies the storage contract:

- backfills `visit_day` and coalesces historical duplicate rows;
- adds the daily unique index used for concurrency-safe dedupe;
- removes authenticated Supabase SELECT/INSERT policies for `profile_visits`, because the API must perform entitlement masking and the backend service role already bypasses RLS;
- establishes a 90-day retention window and an insert-time retention trigger;
- removes visit history in both directions when a block is created;
- removes visit history when an account becomes deleted, deletion-pending, or hidden.

The existing foreign keys also use `ON DELETE CASCADE`, so physical account deletion removes both visits made by and visits received by that account.

## Observability and failure behaviour

The backend logs verification, fetch, and persistence failures without writing viewer/target IDs to log messages. Privacy checks fail closed. Duplicate, self, blocked, unavailable, and incognito results are expected control flow and do not produce error logs or push notifications.

The visitor-list API reports storage failures as errors rather than converting them to an empty list. This lets the Angular UI distinguish `no visitors` from `visitor data temporarily unavailable`.

## Verification

Regression coverage includes:

- non-VIP canonical API responses cannot contain the real visitor ID/name;
- verified VIP owners receive identity;
- self, incognito, blocked, hidden/deleted/deletion-pending views are not recorded;
- duplicate daily inserts coalesce without another notification;
- canonical pagination is bounded and reports the next offset;
- visitor-list storage failures surface as errors;
- the deprecated endpoint cannot bypass server-side VIP masking;
- successful external-profile loads call the visit API and logging failures do not break profile rendering;
- the Angular visitor list has real error/retry, masked, VIP, and load-more states.

## Rollout

1. Apply the Supabase migration before deploying the backend that writes `visit_day`.
2. Deploy the backend and verify both the canonical endpoint and the masked legacy compatibility route.
3. Deploy the Angular client and confirm `/profile/visitors` calls only `/profile-visits/my-visitors`.
4. Monitor backend errors for entitlement verification, block verification, persistence, and list fetch failures.
5. After the supported client population has migrated, remove `/users/me/visitors` and `LegacyProfileVisitorsPrivacyInterceptor` in a separate cleanup change.

## Rollback

If the application deployment must be rolled back, roll back the Angular/backend deployment first while leaving the database hardening in place. The added `visit_day` column and unique index are backward-compatible with the old insert shape because `visit_day` has a default.

Do not restore raw authenticated SELECT access to `profile_visits` as part of an application rollback: doing so would reintroduce the entitlement bypass. If the daily dedupe policy itself must be reverted for product reasons, drop only `profile_visits_unique_daily_idx` after confirming that duplicate notifications are acceptable; retain the RLS, block/deletion purge, and retention protections.
