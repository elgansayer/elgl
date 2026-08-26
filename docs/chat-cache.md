# Frontend chat cache

The Angular chat client uses `ChatCacheService` as an optional IndexedDB acceleration and offline-read layer for chat messages, room summaries, and favourites. The server remains authoritative. Cache failures never change authorization or persistence semantics and must never prevent the client from falling back to the authenticated API.

## Account isolation

Every cache key is scoped to the currently authenticated user. A second account using the same browser cannot read or invalidate another account's cached messages, rooms, or favourites. When there is no authenticated `currentUser`, cache reads return no data and writes are skipped.

Versioned `v2:` keys deliberately make the previous unscoped entries unreachable. `evictStaleEntries()` removes legacy/unscoped records when housekeeping runs. No database migration is required because IndexedDB contains disposable cache data only.

## Freshness and offline behavior

Online reads use short freshness windows:

- room messages: 5 minutes
- room list: 2 minutes
- favourites: 10 minutes

When the browser reports that it is offline, an authenticated user may read their own cached data for up to seven days. This keeps recent conversations usable during connectivity loss without treating old local state as indefinitely valid. Once the browser is online again, data older than the normal freshness window is ignored and the normal API path refreshes it.

Cache collections are bounded before persistence:

- latest 500 messages per room
- first 250 room summaries
- first 500 favourites

This prevents an unexpectedly large server response or long-lived account from creating unbounded IndexedDB growth. Message snapshots retain the newest entries when truncation is required.

## Consistency

Successful online sends already append to an existing cached room snapshot. `appendCachedMessage()` is idempotent by message ID, so an API response and a matching realtime echo cannot create duplicate cached messages. Room/favourite mutation paths continue to invalidate their relevant snapshots.

Search results are not cached because a search query is a derived, potentially incomplete view rather than the canonical room snapshot.

## Failure handling

IndexedDB may be disabled by browser policy, unavailable in private browsing, blocked during an upgrade, or reject writes because of quota pressure. Public cache reads therefore degrade to `null`; writes and invalidations become no-ops. The caller continues through the normal authenticated network path.

Persisted IndexedDB content is treated as untrusted local input. Entries must use the current scoped-key version, contain a finite cache timestamp, and contain an array payload before they can be returned to chat code.

No message text, user identifier, token, room identifier, or provider/database error is logged by the cache layer.

## Privacy and retention

The cache contains private conversation content on the user's device. It must not be copied into analytics, logs, error labels, URLs, or shared browser storage. The seven-day offline retention window is the maximum age accepted by current clients; housekeeping can safely delete older records at any time because the server is authoritative.

Logging out already prevents access because `ChatService` requires an authenticated token and the cache additionally requires an authenticated user scope. Account switching produces a different cache namespace.

## Verification

Focused regression coverage is in `frontend/src/app/services/chat-cache.service.spec.ts`. It covers:

- account isolation and unauthenticated behavior
- online freshness versus bounded offline stale reads
- bounded message/room/favourite storage
- message-ID deduplication
- account-scoped invalidation
- malformed local records
- IndexedDB read/write/delete failures

The repository frontend unit, lint, static-analysis, and build workflows remain the authoritative clean-environment validation.

## Rollout and rollback

This change is frontend-only and requires no backend, API, or schema migration. It is safe to roll out with older clients because the IndexedDB database version and stores are unchanged; new clients simply use a new key namespace.

Rollback is a normal frontend code revert. `v2:` records are ignored by the older unscoped implementation and can be deleted as cache data. No server-side cleanup is required.
