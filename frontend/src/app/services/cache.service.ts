import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CacheService {
  async clearCache(): Promise<void> {
    // Clear localStorage
    localStorage.clear();
    // Clear sessionStorage
    sessionStorage.clear();

    // Clear IndexedDB databases used by the application
    const dbNames = ['hellotalk_cache', 'mediaCache', 'offlineCache'];
    for (const dbName of dbNames) {
      try {
        await indexedDB.deleteDatabase(dbName);
      } catch {
        // ignore if database does not exist
      }
    }

    // Clear Cache Storage (Service Worker / Cache API)
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch {
        // ignore if Cache API is unavailable
      }
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
              return (
                typeof val === 'object' &&
                val !== null &&
                'timestamp' in val
              );
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
