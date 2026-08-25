# Data & Storage settings

The Data & Storage surface is available at `/settings/data-storage` and is backed by `DataStorageService` for the cellular-download preference plus `CacheService` for destructive cache maintenance.

## Cache boundary

"Clear Local Cache" deletes only application-owned cache stores:

- IndexedDB databases `hellotalk_cache`, `mediaCache`, and `offlineCache`;
- Cache Storage entries created by the application/service worker.

It deliberately does **not** call `localStorage.clear()` or `sessionStorage.clear()`. Authentication sessions, unsent drafts, accessibility/theme preferences, onboarding state, and other user-owned browser state are not cache and must survive this action. If a cache store cannot be deleted, the operation reports failure rather than claiming success after a partial clear.

The displayed cache-size estimate follows the same ownership boundary and counts Cache Storage responses only. Web Storage is excluded because it contains durable user/session state.

## Cellular auto-download preference

`DataStorageService.cellularAutoDownload` defaults to enabled and persists the device-local preference under `hellotalk_cellular_auto_download`. Storage access is best-effort so privacy modes or blocked Web Storage do not make the settings page unusable.

This local preference is separate from account-level media download settings on the broader Settings screen. Clearing cache must not reset it.

## Concurrency and failure handling

Cache clearing and old-media deletion are mutually exclusive mutations. A second storage mutation is ignored while one is already in flight. Both operations expose success/failure state and recompute the cache estimate after successful completion.

Cache implementation failures are surfaced without logging browser storage contents, tokens, drafts, media payloads, or other private data.

## Verification

Run the focused frontend tests:

```bash
cd frontend
npm test -- --run src/app/services/cache.service.spec.ts src/app/services/data-storage.service.spec.ts src/app/pages/data-storage/data-storage.component.spec.ts
```

Then run the canonical frontend static-analysis and production-build checks used by repository CI.

## Rollout and rollback

There is no API, database, or server configuration change. The behavioral change is intentionally conservative: cache clearing becomes less destructive by preserving durable Web Storage. Rollback is a normal code revert; do not restore blanket Web Storage deletion as a cache-clearing strategy.
