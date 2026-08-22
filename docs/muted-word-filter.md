# Muted word filter

Issue #1153 adds an account-level keyword filter for Moments. The existing Moments UI already filters `text_content` locally with Unicode-aware word segmentation. This change makes the muted-word list durable across devices and keeps the local cache as an offline fallback.

## Contract

- `GET /safety/muted-words` returns `{ "words": string[] }` for the authenticated account.
- `POST /safety/muted-words` with `{ "word": string }` adds a term and returns the canonical list.
- `DELETE /safety/muted-words` with `{ "word": string }` removes a term and returns the canonical list.
- Terms are NFKC-normalised, trimmed and case-folded before persistence.
- A term is at most 64 characters and an account can store at most 100 terms.
- Duplicate additions are idempotent, including concurrent additions from multiple devices.

The word is deliberately carried in a JSON request body for deletion rather than a URL path/query parameter so private preferences do not become part of normal access-log URLs.

## Storage and authorization

`public.user_muted_words` owns each row with `user_id -> auth.users(id) ON DELETE CASCADE`. RLS permits authenticated users to select, insert and delete only rows where `auth.uid() = user_id`; updates are not granted. Anonymous access is revoked.

A per-user advisory transaction lock in `enforce_user_muted_words_limit()` makes the 100-term cap deterministic under concurrent writes without serialising unrelated users. `(user_id, normalized_word)` is unique.

Muted terms can reveal sensitive interests or topics. Application code must not log individual terms, include them in metrics dimensions, analytics events, URLs, crash breadcrumbs or support diagnostics.

## Frontend behavior

Privacy Settings loads the server list and replaces the existing account-scoped local cache. Add/remove controls are disabled while a mutation is in flight, use a 64-character input bound, expose loading/saving/error states through live regions, and keep retry available after network failures.

If the backend cannot be reached, the last account-scoped local cache remains active so an offline user does not suddenly see content they had already hidden. The error remains visible because local storage is only a fallback, not authoritative state. A successful read or mutation replaces the cache with the canonical server list.

The Moments feed continues to use `SafetyService.filterMomentsByMutedWords()`, which applies NFKC/case normalisation and `Intl.Segmenter` word-like token matching. Multi-token terms must appear as the same contiguous token sequence; emoji/symbol-only terms use exact normalised substring matching. This avoids false positives such as muting `art` hiding `party`.

## Failure and security behavior

- Missing/invalid authentication is rejected by `SupabaseAuthGuard` and the controller additionally fails closed if no user is available.
- Database read/write failures return stable errors and do not expose provider messages or muted terms.
- Malformed or unbounded API responses are rejected by the Angular client instead of replacing known-good local state.
- Add/remove failures leave the existing local list intact; failed additions also keep the typed input so the user can retry.
- The database limit is authoritative, so multi-device races cannot exceed 100 entries.

## Verification

Focused coverage lives in:

- `backend/src/safety/muted-words.service.spec.ts`
- `backend/src/safety/muted-words.controller.spec.ts`
- `frontend/src/app/services/muted-words-api.service.spec.ts`
- `frontend/src/app/pages/settings/privacy-settings/privacy-settings.component.spec.ts`
- existing `frontend/src/app/services/safety.service.spec.ts` tests for Unicode/token matching and account-isolated local fallback

Before rollout, run the repository verification pipeline and a clean Supabase migration replay. Manually verify two accounts in the same browser, two devices for one account, add/remove retry while offline, 400% zoom, keyboard-only operation, and light/dark themes.

## Rollout

1. Apply `20260822230000_create_user_muted_words.sql` before deploying the backend routes.
2. Deploy the backend and verify authenticated GET/POST/DELETE with two distinct test users.
3. Deploy the frontend. Existing local-only terms remain available as an offline fallback; users can re-save any legacy local terms they want synced to the account.
4. Monitor only aggregate request/error/latency metrics. Never record term values.

## Rollback

The frontend can be rolled back independently; its previous account-scoped local cache behavior continues to work. The backend can then be rolled back while leaving `user_muted_words` in place, which is safest because the table contains user preference data and is inert without callers. Remove the table/function/trigger only in a separately reviewed data-deletion migration after the retention impact is understood. Do not edit or delete the already-applied migration file.
