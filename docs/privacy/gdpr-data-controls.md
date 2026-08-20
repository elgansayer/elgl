# GDPR personal data controls

The privacy hub exposes authenticated self-service controls for data access and account erasure. The implementation is split between the Angular `/gdpr` surface, the NestJS `/privacy` API, Supabase metadata, and the existing account-deletion worker.

## Data archive flow

`POST /privacy/request-archive` collects the authenticated user's supported personal data and uploads a JSON archive to the private `gdpr-archives` Supabase Storage bucket. Archive objects use a user-scoped path and the database stores that private path in `archive_requests.archive_path`; the API does not persist or log a durable public download URL.

`GET /privacy/status` returns the caller's deletion state and the latest archive state. When an archive is available, the backend signs its private object path for 15 minutes and returns that short-lived URL. The Angular GDPR hub restores the latest link after navigation/reload and opens it as an explicit user action. A signing failure does not make the bucket public and does not expose the object path as a download URL.

The `archive_requests` table is readable only by the owning authenticated user under RLS. Backend writes use the Supabase service role, which bypasses RLS. The historical broad `FOR ALL USING (true)` policy is intentionally removed because an unscoped permissive policy would otherwise grant client roles mutation access.

## Account deletion flow

`POST /privacy/delete-account` requires an explicit confirmation value. It schedules deletion 30 days in the future, immediately removes stored location fields from the user row, hides the account from discovery, and invalidates user caches. `POST /privacy/cancel-deletion` clears the pending deletion fields during the grace period.

The existing `AccountDeletionCron` in `UsersModule` is the canonical finalisation worker. It runs daily and calls `UsersService.permanentDeleteAccount` for accounts whose grace period has expired. The GDPR hub loads `/privacy/status` on entry so the cancellation control remains available after a page reload or a new session.

## Failure and privacy behaviour

Archive creation fails closed if storage upload or metadata persistence fails. If metadata persistence fails after an upload, the backend attempts to remove the orphaned object. Signed-URL creation failures are logged without the URL and result in no download link being returned. User IDs may appear in operational logs for correlation, but archive contents and signed URLs must not be logged.

Status and mutation endpoints remain protected by `SupabaseAuthGuard`; clients cannot supply a different target user ID. Archive storage remains private even if a client learns an object path. Signed URLs are intentionally short lived and should not be copied into analytics, crash reports, or application logs.

## Verification

Automated coverage includes the existing privacy service archive/deletion tests, focused status tests for signed URL generation and fail-closed status loading, and Angular component tests for archive creation, signed-link rendering, deletion confirmation, cancellation, errors, and restoration of pending deletion state.

Manual verification for a staging deployment:

1. Apply the Supabase migration before deploying the backend.
2. Sign in as a normal user and open the GDPR/privacy hub.
3. Request an archive and verify a download action appears and the JSON file is accessible only through the signed URL.
4. Confirm the `gdpr-archives` bucket is private and `archive_requests.archive_url` is not populated for new exports.
5. Request account deletion, reload the page, and verify the cancellation control is still visible.
6. Cancel deletion and verify the pending state disappears after reload.
7. Verify another authenticated user cannot mutate or read the first user's `archive_requests` rows through the Supabase client.

## Rollout and rollback

Deploy the migration first because it only adds a nullable column, adds an index, removes an unsafe client-write policy, and forces the archive bucket to private. Existing application versions continue to function during that database-first window, although old code-generated public bucket URLs will no longer be downloadable once the bucket is private.

Then deploy the backend and frontend together so new archives store `archive_path` and the UI can request signed URLs. Existing archive rows without `archive_path` remain valid historical metadata but do not receive a signed download link.

Rollback application code with a normal revert. Do not restore the broad RLS policy or make the bucket public as part of rollback. The nullable `archive_path` column and composite index are safe to leave in place; a later cleanup migration can remove them if the feature is permanently retired.
