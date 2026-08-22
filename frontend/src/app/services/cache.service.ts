import { Injectable } from '@angular/core';

const LOCAL_CACHE_PREFIXES = ['elgl:tr:'] as const;
const CACHE_DATABASE_NAMES = ['hellotalk_cache', 'mediaCache', 'offlineCache'] as const;

export interface CacheClearResult {
  localEntriesRemoved: number;
  cacheStoresRemoved: number;
  databasesRemoved: number;
}

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  /**
   * Clears transient application caches without touching durable user state such
   * as authentication, preferences, drafts, onboarding progress, or session data.
   * A partial browser-storage failure rejects after all cleanup attempts finish so
   * the UI can report that the cache may not have been fully cleared.
   */
  async clearCache(): Promise<CacheClearResult> {
    let localEntriesRemoved = 0;
    let cacheStoresRemoved = 0;
    let databasesRemoved = 0;
    let failedOperations = 0;

    try {
      localEntriesRemoved = this.clearLocalCacheEntries();
    } catch {
      failedOperations += 1;
    }

    if (typeof indexedDB !== 'undefined') {
      const databaseResults = await Promise.all(
        CACHE_DATABASE_NAMES.map((name) => this.deleteDatabase(name)),
      );
      databasesRemoved = databaseResults.filter(Boolean).length;
      failedOperations += databaseResults.length - databasesRemoved;
    }

    if (typeof caches !== 'undefined') {
      try {
        const cacheNames = await caches.keys();
        const cacheResults = await Promise.allSettled(
          cacheNames.map(async (name) => {
            const deleted = await caches.delete(name);
            if (!deleted) {
              throw new Error('Cache store was not deleted');
            }
            return true;
          }),
        );
        cacheStoresRemoved = cacheResults.filter((result) => result.status === 'fulfilled').length;
        failedOperations += cacheResults.length - cacheStoresRemoved;
      } catch {
        failedOperations += 1;
      }
    }

    if (failedOperations > 0) {
      throw new Error('Browser cache cleanup was only partially successful');
    }

    return { localEntriesRemoved, cacheStoresRemoved, databasesRemoved };
  }

  async deleteOldMedia(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    // Delete cached media stored in IndexedDB store 'mediaCache' older than 30 days.
    try {
      const openReq = indexedDB.open('mediaCache');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error);
      });

      if (!db.objectStoreNames.contains('media')) {
        db.close();
        return;
      }

      const transaction = db.transaction('media', 'readwrite');
      const store = transaction.objectStore('media');
      const cursorReq = store.openCursor();
      await new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor) {
            const entry = cursor.value;
            const ageDays = (function isTimestamp(
              val: unknown,
            ): val is { timestamp: number } {
              return (
                typeof val === 'object' &&
                val !== null &&
                'timestamp' in val &&
                typeof (val as { timestamp?: unknown }).timestamp === 'number'
              );
            })(entry)
              ? (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24)
              : Infinity;
            if (ageDays > 30) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
        transaction.onabort = () => reject(transaction.error);
      });
      db.close();
    } catch {
      // IndexedDB is an optional cache. Missing stores and denied browser storage
      // must not make the rest of the application unusable.
    }
  }

  private clearLocalCacheEntries(): number {
    if (typeof localStorage === 'undefined') return 0;

    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    return keysToRemove.length;
  }

  private deleteDatabase(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      try {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => finish(true);
        request.onerror = () => finish(false);
        request.onblocked = () => finish(false);
      } catch {
        finish(false);
      }
    });
  }
}
