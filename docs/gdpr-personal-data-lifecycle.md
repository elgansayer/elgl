# GDPR personal-data lifecycle

## Scope

ELGL exposes a signed-in Privacy / GDPR hub for two user-controlled operations:

1. **Request My Data Archive** creates a complete, bounded JSON export and immediately downloads it through a short-lived signed URL.
2. **Delete Account** starts a 30-day grace period. The account is hidden from discovery and precise/mock location data is scrubbed immediately. The user can cancel during the grace period. The existing account-deletion scheduler permanently removes expired accounts after the grace period.

This document describes the production trust boundaries, retention policy, failure behaviour, and rollback considerations introduced for issue #570.

## Archive lifecycle

`POST /api/privacy/request-archive` is authenticated with `SupabaseAuthGuard` and rate limited to three requests per hour. The service creates at most one `processing` archive per user. Retries while an export is running return the existing request rather than starting duplicate collection work. An unexpired `ready` export is also reused and receives a fresh signed URL.

State transitions are:

```text
request -> processing -> ready -> expired
                     \-> failed
```

The API never stores or logs the signed download URL. The database stores an opaque random object key instead. The `gdpr-archives` bucket is private, has a 50 MiB object limit, accepts only JSON, and is accessed for writes/signing/deletes through the backend service-role client. Signed URLs default to 300 seconds and are bounded to 60-900 seconds through `GDPR_ARCHIVE_SIGNED_URL_SECONDS`.

Historical rows that contained public archive URLs are invalidated by migration and must be regenerated. This intentionally favours confidentiality over preserving an unsafe legacy link.

### Completeness and bounds

The export treats each configured dataset as required. A provider/query failure fails the whole request instead of silently replacing missing data with `null` or an empty array. Collection tables are paged in 500-row batches and capped at 50,000 rows per dataset; reaching the cap fails the request rather than returning an archive that looks complete but is truncated. Deck junction rows are fetched in bounded deck-ID chunks.

The archive currently contains the profile, Moments and comments, sent chat messages, flashcards/decks and deck membership, favourites, coin purchases, escrow transactions, gift transactions, unlocked sticker packs, reading progress, and user-created reading resources. Existing economy scrubbers continue to redact counterparty/payment secrets while preserving the requesting user's own data.

## Retention

Ready exports default to seven days of retention and may be configured from 1-30 days through `GDPR_ARCHIVE_RETENTION_DAYS`. `PrivacyArchiveCron` runs daily and removes expired objects in bounded batches before marking the database record `expired` and clearing its object key. A failed object deletion remains `ready`, so the next run retries rather than losing the only pointer to the private object.

Archive metadata is retained with the account for audit/state purposes and cascades away when `public.users` is permanently deleted. By normal operation, archive objects have already expired more than three weeks before the 30-day account-deletion grace period ends.

## Account deletion lifecycle

`POST /api/privacy/delete-account` requires explicit confirmation and is rate limited. It atomically updates the user profile to:

- set `scheduled_for_deletion_at` 30 days ahead;
- record `deletion_requested_at` and `is_deletion_pending`;
- hide the account from discovery; and
- immediately clear precise and mock location values.

Relevant Redis safety/discovery caches are invalidated after the database update succeeds. A persistence failure fails closed and does not report deletion as scheduled.

`POST /api/privacy/cancel-deletion` clears the deletion markers. The existing `AccountDeletionCron` finds accounts whose grace period has elapsed and invokes permanent deletion.

`public.users.id` references `auth.users.id` with `ON DELETE CASCADE`, but that relationship does not delete the auth principal when the profile is deleted. Migration `20260824220500_harden_gdpr_archives.sql` therefore installs an `AFTER DELETE` security-definer trigger on `public.users` that deletes the matching `auth.users` row. This ensures the automated permanent deletion path removes the login-capable principal in the same transaction rather than leaving an orphaned Supabase Auth account.

## Security and privacy invariants

- Browser roles cannot insert, update, or delete `archive_requests`.
- Authenticated users may only select their own archive request metadata through RLS.
- The archive bucket is never public.
- Opaque storage keys contain no user ID, email address, or timestamp.
- Signed URLs are generated only after an authenticated request is matched to a ready archive owned by that user.
- Signed URLs, archive object keys, user IDs, raw provider errors, and exported content are not written to operational logs.
- User-controlled archive requests are rate limited and concurrent generation is deduplicated by a partial unique index.
- Non-HTTP(S) download URLs are rejected by the Angular UI before navigation.

## Observability

Operational logs use stable event names such as `gdpr_archive_generation_failed`, `gdpr_archive_dataset_failed dataset=<name>`, and `gdpr_archive_retention_cleanup count=<n>`. They intentionally contain no direct user identifier, object key, signed URL, archive content, or provider exception text. `archive_requests.status` and `failure_code` provide database-side correlation when operators need to diagnose a failed request.

## Verification

At minimum, deployment verification should confirm:

1. a clean Supabase migration replay succeeds;
2. `storage.buckets.public` is false for `gdpr-archives`;
3. authenticated browser clients cannot mutate `archive_requests` or directly list/read the archive bucket;
4. a signed-in archive request produces a JSON download through a short-lived signed URL;
5. repeat requests reuse processing/unexpired exports;
6. a failed dataset query returns an error and does not upload a partial archive;
7. expired objects are removed and their request rows become `expired`;
8. deletion immediately removes location/discovery visibility, cancellation restores the pending state, and an expired deletion removes both the profile and Supabase Auth principal.

Focused backend and Angular unit tests cover the archive lifecycle, pagination, partial failure, cleanup, signed-download handling, retry/concurrency guards, and deletion state transitions.

## Rollout and rollback

Deploy the database migration before or with the backend. Mixed-version safety is intentional: legacy `archive_url` remains present but is nullable and no new code writes it. Old public URLs are invalidated as part of the security migration.

If the application must be rolled back, keep the private bucket and hardened RLS in place. Reverting to public archive URLs would reintroduce the confidentiality defect. A compatible rollback should disable archive generation in the older application until the signed-download implementation is restored. The auth-deletion trigger should also remain in place because removing it can leave login-capable auth principals after profile deletion.
