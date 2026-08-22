# Data & Storage

The Data & Storage settings screen is available at `/settings/data-storage`. The legacy `/data-storage` route redirects to the canonical settings URL so existing bookmarks continue to work.

## User-visible behavior

The page reports a best-effort size for transient browser caches, allows the user to delete cached media older than 30 days, and stores whether automatic media downloads are allowed on cellular networks. Clearing the cache uses an explicit two-step confirmation and provides success or failure feedback.

Cache size is intentionally not an estimate of all browser storage. Drafts, authentication/session state, accessibility settings, theme/language preferences, onboarding state, and other durable local state are not cache and are excluded.

## Cache ownership and privacy

`CacheService.clearCache()` may delete only known transient cache storage:

- local translation cache entries with the `elgl:tr:` prefix;
- Cache Storage entries used by the application/service worker;
- the `hellotalk_cache`, `mediaCache`, and `offlineCache` IndexedDB databases.

It must not call `localStorage.clear()` or `sessionStorage.clear()`. In particular, unsent chat/Moment drafts and authentication-related state must survive a cache clear. New local caches should use an explicit namespace and be added to this ownership list deliberately rather than broadening deletion to unrelated keys.

The cellular auto-download preference is stored under `hellotalk_cellular_auto_download`. Preference persistence is best effort so private browsing or denied storage access does not break the settings screen.

No cache contents, draft text, tokens, or other private browser data are logged or sent to the backend by these controls.

## Failure handling

Browser storage APIs are optional and can be unavailable, denied, blocked by another tab, or fail because of browser implementation limits. Cache clearing attempts every configured transient store before reporting a partial failure. The confirmation remains available after failure so the user can retry. Cache-size calculation degrades to the subset of cache APIs that remain available rather than inventing a value.

Old-media deletion treats a missing IndexedDB database/store as an empty cache. It never deletes remote media or server-side message history.

## Verification

Frontend unit coverage verifies:

- cellular auto-download preference load, explicit update, and persistence;
- cache-size accounting excludes durable local/session state;
- translation, Cache API, and IndexedDB cache cleanup;
- durable drafts/preferences/session data survive cache clearing;
- blocked or partially failed browser cleanup is reported;
- clear-cache confirmation, cancellation, retry/failure state, and size refresh behavior.

Repository CI should run the normal frontend unit, static-analysis, build, accessibility/design governance, and translation-safety checks.

## Rollout and rollback

No backend API or database migration is required. The change can be rolled out with the frontend independently.

Rollback is code-only. Reverting the frontend commits restores the previous behavior; no server data needs migration. Do not reintroduce whole-origin `localStorage.clear()`/`sessionStorage.clear()` as part of rollback, because that can destroy unsent drafts and durable user preferences.
