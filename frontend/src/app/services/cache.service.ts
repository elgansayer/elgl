import { Injectable } from '@angular/core';

const APP_CACHE_DATABASES = ['hellotalk_cache', 'mediaCache', 'offlineCache'] as const;

function deleteIndexedDbDatabase(name: string): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Unable to clear local cache'));
    request.onblocked = () => reject(new Error('Unable to clear local cache'));
  });
}

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  /**
   * Removes app-owned cache stores without touching authentication, drafts, or preferences
   * persisted in Web Storage.
   */
  async clearCache(): Promise<void> {
    const results = await Promise.allSettled(APP_CACHE_DATABASES.map(deleteIndexedDbDatabase));
    const failures = results.filter((result) => result.status === 'rejected');

    if (typeof caches !== 'undefined') {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        failures.push({ status: 'rejected', reason: new Error('Cache API unavailable') });
      }
    }

    if (failures.length > 0) {
      throw new Error('Unable to clear local cache');
    }
  }

  async deleteOldMedia(): Promise<void> {
    // Delete cached media stored in IndexedDB store 'mediaCache' older than 30 days
    try {
      const openReq = indexedDB.open('mediaCache');
      openReq.onupgradeneeded = () => {
        // database may already exist; no schema changes needed
      };
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        openReq.onsuccess = () => resolve(openReq.result);
        openReq.onerror = () => reject(openReq.error);
      });
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
              return typeof val === 'object' && val !== null && 'timestamp' in val;
            })(entry)
              ? (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24)
              : Infinity;
            if (ageDays > 30) {
              store.delete(cursor.primaryKey);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
      db.close();
    } catch {
      // Database not available or store doesn't exist – nothing to delete
    }
  }
}
