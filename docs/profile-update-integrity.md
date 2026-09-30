# Profile update integrity

## Scope

`PATCH /users/me` remains the canonical authenticated profile mutation endpoint. `UsersController` and `UsersService` continue to own validation, mutation construction, cache invalidation, and profile update events. The `ProfileUpdateIntegrityInterceptor` adds fail-closed checks around the profile fields covered by #1684 without introducing a second profile store.

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

`UpdateProfileDto` provides the transport-level ceiling for target languages. It accepts at most five entries so Pro and Developer requests can reach the authoritative entitlement check; the lower Free and Consumer VIP limits are enforced server-side from persisted subscription state.

## Authentication and authorization

`UsersController` is protected by `SupabaseAuthGuard`, and `PATCH /users/me` also uses `TwoFactorGuard`. The integrity interceptor never accepts a caller-supplied user ID; it uses the authenticated `request.user.id`/`sub` established by the auth boundary.

Free users may persist one target language. Any request containing more than one target language performs a direct `users.is_vip,vip_tier` lookup before the controller executes. This lookup deliberately does not use `UsersService.getProfile()` because that legacy read path can return a development/mock profile during provider failures. A missing or unavailable entitlement therefore fails closed instead of accidentally granting a paid multi-language update.

The persisted tier determines the maximum:

- Free: 1 target language.
- Consumer VIP (including legacy/unknown VIP tier values): 3 target languages.
- Pro: 5 target languages.
- Developer: 5 target languages, matching the existing `UsersService` paid-tier contract.

A request exceeding its persisted tier fails before the profile mutation runs. The DTO independently rejects more than five entries before entitlement work.

## Persistence verification

After the existing controller/service mutation completes, the interceptor reads back only the core fields present in the request. The response is returned only when persisted state exactly matches the requested strings, booleans, and language arrays.

This closes a legacy failure mode where `UsersService.updateProfile()` can return a mock-shaped profile when Supabase persistence fails. For the #1684 profile fields, a failed/no-op write is surfaced as an error rather than a successful response.

The read-back is intentionally bounded to requested fields. It does not scan other users or load unrelated profile content.

## Failure behavior

- Missing authenticated identity: `401 Unauthorized`.
- Multi-language entitlement lookup cannot reach storage: `503 Service Unavailable`.
- Authenticated identity has no persisted profile row: `404 Not Found`.
- Free user requests more than one target language: `400 Bad Request`.
- Consumer VIP requests more than three target languages: `400 Bad Request`.
- Any request contains more than five target languages: `400 Bad Request` at DTO validation.
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
- Consumer VIP users can save three target languages but not four;
- Pro and Developer users can save up to five target languages;
- the DTO admits the five-language paid-tier transport contract and rejects six;
- the free one-language path remains available;
- mock-success/non-persisted core updates are rejected;
- post-write provider failures fail closed;
- native-language arrays and privacy booleans are verified exactly;
- `UsersModule` keeps the interceptor registered as an `APP_INTERCEPTOR`.

Repository CI remains authoritative for the full backend unit, lint, build, and E2E gates.

## Rollout and rollback

There is no database migration. Deploy the backend normally. The entitlement lookup now reads `vip_tier` together with `is_vip`; existing profile rows remain compatible because missing/legacy paid tier values intentionally retain the Consumer VIP three-language limit.

Rollback is a normal code/documentation revert. Rolling back restores the previous three-entry DTO ceiling and boolean-only VIP check; no data repair or schema rollback is required.
