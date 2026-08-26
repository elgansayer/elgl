# Developer Tier API key management

Issue: #1003

## Existing product surface

Developer Tier is the `developer_20_ukp_26_usd` subscription and is enforced by `SupabaseAuthGuard`, `VipGuard` and `@RequireVip('developer')` on the existing monetisation endpoints.

The current product surface already provides:

- `POST /monetisation/generate-api-key` for Developer Tier key generation/rotation;
- `GET /monetisation/analytics` for the authenticated developer's usage and latency summary;
- the Angular `/developer` dashboard for subscription upgrade, key issuance, telemetry and diagnostics;
- a 600 RPM value returned for Developer Tier credentials.

Generating a key replaces the previous key. This is intentionally a single-active-key model, which makes retries and operator recovery predictable while the product has no named/multi-key workflow.

## Credential lifecycle

### Issue / rotate

The backend generates a cryptographically random `ht_dev_` credential. The raw value is returned only by the successful issuance response. The database trigger introduced by `20260822000500_harden_developer_api_key_storage.sql` immediately transforms the value before the row is stored:

1. SHA-256 digest into `users.developer_api_key_hash`;
2. display prefix into `users.developer_api_key_prefix`;
3. final four characters into `users.developer_api_key_last_four`;
4. rotation timestamp into `users.developer_api_key_created_at`;
5. redacted identifier into the legacy `users.developer_api_key` column.

This preserves mixed-version compatibility with the existing backend, which still assigns the generated raw value to `developer_api_key`, while ensuring the reusable credential is not retained at rest.

The existing analytics response retains its `api_key` field for compatibility. After issuance it contains only the redacted identifier, so refreshing the dashboard cannot recover the secret.

### Revoke

The persistence contract supports trusted revocation by setting `developer_api_key` to `NULL`; the trigger clears the digest and all derived metadata atomically. The current UI's rotation action remains the supported self-service management flow. A future explicit revoke endpoint can use the same storage contract without a schema change.

### Direct-client protection

Developer credential fields are server-managed. The trigger rejects changes initiated under Supabase `anon` or `authenticated` request roles, so a browser cannot mint, replace, redact or alter credential metadata directly even if a future RLS regression broadens access to the users table.

The trigger also rejects attempts to modify the digest/prefix/timestamp independently from the source key. This prevents metadata drift and makes the digest the canonical verification material.

## Analytics contract

`GET /monetisation/analytics` remains bounded to the authenticated user's row and the matching `developer_metrics` row. No collection scan or cross-user lookup is introduced by this change.

The dashboard continues to expose:

- Developer Tier status;
- API calls for the current day;
- average request latency;
- the Developer Tier rate-limit value;
- a redacted active-key identifier after issuance.

Credential plaintext, digest values and payment-provider secrets must never be placed in diagnostic logs, application logs, browser analytics or error payloads.

## Failure behaviour

- Non-Developer users remain rejected by `VipGuard` before key issuance or developer analytics access.
- Malformed key values fail closed with PostgreSQL error code `22023`; arbitrary strings are never persisted as credentials.
- Direct browser writes to credential fields fail with `42501`.
- A duplicate digest violates the unique partial index rather than creating ambiguous credential ownership.
- Unrelated user-profile updates do not rotate or re-hash the key.
- Explicit trusted revocation clears every derived credential field in one row update.

The existing backend should continue converting persistence failures into a failed issuance request. Callers must treat a failed response as non-issuance and retry through the authenticated endpoint rather than attempting direct database writes.

## Migration and mixed-version rollout

Deploy the migration before or with the application release.

The migration is replay-safe:

- columns use `ADD COLUMN IF NOT EXISTS`;
- the digest index uses `CREATE UNIQUE INDEX IF NOT EXISTS`;
- the trigger function uses `CREATE OR REPLACE FUNCTION`;
- the trigger is dropped/re-created deterministically;
- the backfill only matches legacy raw credentials with the exact `ht_dev_` plus 32-hex-character shape.

Old backend versions remain compatible because they can continue writing raw generated keys to `users.developer_api_key`; the database trigger protects those writes. Existing plaintext keys are hashed/redacted during migration. Users do not need to rotate solely to complete the migration, although normal credential-rotation hygiene still applies.

## Verification

After applying the migration in a non-production environment:

1. Confirm a Developer Tier account can call `POST /monetisation/generate-api-key` and receives one raw `ht_dev_...` value.
2. Query the user's row with service-role access and verify `developer_api_key` is redacted, `developer_api_key_hash` is a 64-character hex digest and the raw key is absent.
3. Refresh `/developer` or call `GET /monetisation/analytics`; verify only the redacted identifier is returned.
4. Generate another key and verify the digest, redacted identifier and rotation timestamp change atomically.
5. Attempt a direct authenticated Supabase update of a credential field and verify it is rejected.
6. Run the backend migration-contract test suite and the repository's clean Supabase migration replay.

## Rollback and recovery

The migration intentionally converts legacy plaintext credentials into non-reversible digests. Rolling back application code does not require restoring plaintext and must not attempt to do so.

If the trigger must be disabled during incident recovery, keep the digest columns and redacted legacy value in place and stop key issuance until the trigger is restored. Do not remove the protection while allowing `POST /monetisation/generate-api-key` to continue writing raw credentials.

A schema rollback may drop the trigger/function and new metadata columns only after key issuance is disabled and all consumers have been verified not to require them. The safe operational rollback is therefore application rollback plus temporary issuance disablement, not plaintext restoration.

## Retention and deletion

Credential metadata lives on the user's row and follows the existing account-retention/deletion lifecycle. No additional user-linked table, background cleanup job or unbounded historical key collection is introduced. Rotation overwrites the prior digest, preserving the single-active-key model.
