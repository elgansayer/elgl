# Who Viewed Me UI contract

This document describes the production boundary for the Angular `VisitorLogsComponent` used by `/visitors`.

## Product behaviour

- The authenticated `GET /profile-visits/my-visitors` endpoint remains authoritative for whether a row is visible or masked.
- Free-tier learners see masked visitor rows and the standard VIP upgrade prompt (`8 UKP / $10 USD VIP`).
- VIP learners see visitor identity only when the backend returns `is_blurred: false`.
- A server-masked row also triggers the upgrade prompt even if the separately loaded profile entitlement is stale. This keeps mixed-version deployments fail-safe.
- Visitor loading has distinct loading, unavailable/retry, empty and populated states. Failure to load the learner profile does not hide an otherwise valid visitor collection.
- The collection remains bounded to the backend contract of 50 rows, ordered newest first.

## HTTP privacy and abuse boundary

- Both visit recording and visitor-log reads remain protected by `SupabaseAuthGuard` and are bounded to 30 requests per minute per throttler identity.
- `GET /profile-visits/my-visitors` returns `Cache-Control: private, no-store` so visitor identity data is not retained by shared or browser HTTP caches.
- The backend remains the source of truth for VIP masking. The browser must never reconstruct visitor identity from entitlement state or cached profile data.
- The visit collection remains intentionally bounded rather than exposing an unbounded profile-history scan.

## Privacy and untrusted response handling

The browser must not rely on CSS blur as the privacy boundary. `normalizeVisitorLogs()` treats the API response as untrusted and replaces every `is_blurred: true` visitor object with an opaque placeholder before the component stores it. Names, avatar URLs, visitor IDs, biography data and language metadata accidentally included in a masked response are discarded from component state and cannot be exposed by a later template change.

Visible avatar URLs are accepted only when they are absolute HTTP(S) URLs without embedded credentials. Malformed, `data:`, `javascript:` and credential-bearing URLs render as the normal avatar placeholder.

The API currently returns `native_language` for profile-visit rows while older frontend fixtures use `native_languages`. The rendering boundary accepts both shapes and normalizes them to the existing frontend `native_languages: string[]` contract. This is intentionally a mixed-version compatibility shim and can be removed once the backend response contract is migrated explicitly.

No visitor identity, profile content, entitlement, token or raw provider error is logged or added to analytics by this UI.

## Accessibility

- The page exposes its heading through `aria-labelledby` and loading through `aria-busy` plus a polite status region.
- Provider failure uses an alert and a keyboard-operable Spartan Retry button.
- Masked placeholder content is hidden from assistive technology; the separate VIP-only badge conveys the state without relying on blur or colour alone.
- The Hide masked / Show all control updates both visible copy and its accessible name when toggled.
- Existing responsive wrapping and touch-sized controls remain in place for narrow screens and high zoom.

## Verification

Automated coverage checks:

- free/VIP upgrade prompt behaviour;
- masked identity removal from component state and DOM;
- visible visitor rendering;
- singular/plural native-language compatibility;
- unsafe avatar URL rejection;
- malformed/unbounded collection handling;
- visitor-provider failure and retry;
- profile-provider partial failure;
- masked-row filtering and dynamic accessible labels;
- authenticated and throttled profile-visit HTTP routes;
- private, non-cacheable visitor-log responses;
- newest-first, 50-row backend collection bound.

Repository CI remains authoritative for the full Angular unit/static-analysis/build and UI-governance suites.

## Rollout and rollback

This hardening change requires no schema migration, API deployment ordering or data backfill and is safe with current and older profile-visit response shapes.

Rollback is a normal application revert. Do not reintroduce cacheable visitor-log responses or rendering/storage of identity fields from `is_blurred: true` rows as part of a rollback; the server-side masking contract remains the privacy boundary regardless of UI version.
