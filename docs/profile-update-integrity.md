# Profile update integrity

## Scope

`PATCH /users/me` remains the canonical authenticated profile mutation endpoint. `UsersController` and `UsersService` continue to own validation, mutation construction, cache invalidation, and profile update events. The `ProfileUpdateIntegrityInterceptor` adds fail-closed checks around the fields called out by issue #951 without introducing a second profile store.

The integrity boundary covers:

- `bio_text`
- `native_languages`
- `target_languages`
- `privacy_hide_age`
- `privacy_hide_location`
- `privacy_hide_from_search`
- `privacy_hide_gender`
- `privacy_hide_exact_location`
- `privacy_hide_online_status`

All existing `UpdateProfileDto` validation remains authoritative. In particular, the request DTO bounds target languages to three entries.

## Authentication and authorization

`UsersController` is protected by `SupabaseAuthGuard`, and `PATCH /users/me` also uses `TwoFactorGuard`. The integrity interceptor never accepts a caller-supplied user ID; it uses the authenticated `request.user.id`/`sub` established by the auth boundary.

Free users may persist one target language. A request containing two or three target languages performs a direct `users.is_vip` lookup before the controller executes. This lookup deliberately does not use `UsersService.getProfile()` because that legacy read path can return a development/mock profile during provider failures. A missing or unavailable entitlement therefore fails closed instead of accidentally granting a VIP-only multi-language update.

VIP users may persist up to three target languages through this endpoint, matching `UpdateProfileDto` and the consumer VIP product contract.

## Persistence verification

After the existing controller/service mutation completes, the interceptor reads back only the core fields present in the request. The response is returned only when persisted state exactly matches the requested strings, booleans, and language arrays.

This closes a legacy failure mode where `UsersService.updateProfile()` can return a mock-shaped profile when Supabase persistence fails. For the issue #951 profile fields, a failed/no-op write is now surfaced as an error rather than a successful response.

The read-back is intentionally bounded to requested fields. It does not scan other users or load unrelated profile content.

## Failure behavior

- Missing authenticated identity: `401 Unauthorized`.
- Multi-language entitlement lookup cannot reach storage: `503 Service Unavailable`.
- Authenticated identity has no persisted profile row: `404 Not Found`.
- Free user requests more than one target language: `400 Bad Request`.
- Post-write verification cannot reach storage: `503 Service Unavailable`.
- Post-write values do not match requested core profile values: `500 Internal Server Error`.

The interceptor logs only sanitized failure categories. It does not log user IDs, profile values, Supabase error messages, credentials, or tokens.

## Concurrency and retries

Profile updates remain idempotent assignments. The verification read occurs after the mutation in the same request. A competing update to the same field can cause the first request to fail verification rather than report a state it no longer owns; clients should reload the profile before retrying.

No new persisted state, queues, retention policy, or migration is introduced.

## Verification

Focused Vitest coverage validates:

- unrelated handlers bypass the integrity layer;
- missing authentication fails before mutation;
- non-VIP multi-language requests are rejected;
- entitlement-provider failures fail closed;
- verified VIP users can save three target languages;
- the free one-language path remains available;
- mock-success/non-persisted core updates are rejected;
- post-write provider failures fail closed;
- native-language arrays and privacy booleans are verified exactly;
- `UsersModule` keeps the interceptor registered as an `APP_INTERCEPTOR`.

Repository CI remains authoritative for the full backend unit, lint, build, and E2E gates.

## Rollout and rollback

There is no database migration. Deploy the backend normally. The new checks apply immediately to `PATCH /users/me`; frontend contracts and response shapes are unchanged on successful writes.

Rollback is a normal revert of the interceptor registration and implementation. Rolling back removes the fail-closed/read-back protection but does not require data repair because this change creates no schema or persisted state.
