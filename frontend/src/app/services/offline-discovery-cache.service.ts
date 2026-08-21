import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { UserProfile } from './user.service';

const DB_NAME = 'hellotalk_discovery_cache';
const DB_VERSION = 1;
const STORE_PARTNERS = 'partners';
const STORE_SEARCH = 'searchResults';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineDiscoveryCacheService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly isOnline = this.networkStatus.isOnline;
  readonly cachedDataAvailable = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshAvailability())
        .catch(() => undefined);
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest) || !target.result) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_PARTNERS)) {
          db.createObjectStore(STORE_PARTNERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_SEARCH)) {
          db.createObjectStore(STORE_SEARCH, { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('IndexedDB not initialised');
    return this.db;
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private async refreshAvailability(): Promise<void> {
    try {
      await this.ensureDB();
      this.cachedDataAvailable.set(true);
    } catch {
      this.cachedDataAvailable.set(false);
    }
  }

  // --- Partner-level caching (for partner profiles seen in discovery) ---

  async cachePartner(partner: UserProfile): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PARTNERS, 'readwrite');
      const entry = { ...partner, _cachedAt: Date.now() };
      tx.objectStore(STORE_PARTNERS).put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async cachePartners(partners: UserProfile[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PARTNERS, 'readwrite');
      const store = tx.objectStore(STORE_PARTNERS);
      for (const partner of partners) {
        store.put({ ...partner, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedPartner(partnerId: string): Promise<UserProfile | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PARTNERS, 'readonly');
      const req = tx.objectStore(STORE_PARTNERS).get(partnerId);
      req.onsuccess = () => {
        const raw = req.result;
        if (!isRecord(raw)) {
          resolve(null);
          return;
        }
        const cachedAt = raw['_cachedAt'];
        if (typeof cachedAt === 'number' && Date.now() - cachedAt < CACHE_TTL_MS) {
          const profile: Record<string, unknown> = {};
          for (const key of Object.keys(raw)) {
            if (key !== '_cachedAt') {
              profile[key] = raw[key];
            }
          }
          resolve(profile as unknown as UserProfile);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCachedPartners(): Promise<UserProfile[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PARTNERS, 'readonly');
      const req = tx.objectStore(STORE_PARTNERS).getAll();
      req.onsuccess = () => {
        const rawResult = req.result;
        if (!Array.isArray(rawResult)) {
          resolve([]);
          return;
        }
        const valid: UserProfile[] = [];
        for (const raw of rawResult) {
          if (!isRecord(raw)) continue;
          const cachedAt = raw['_cachedAt'];
          if (typeof cachedAt === 'number' && Date.now() - cachedAt < CACHE_TTL_MS) {
            const profile: Record<string, unknown> = {};
            for (const key of Object.keys(raw)) {
              if (key !== '_cachedAt') {
                profile[key] = raw[key];
              }
            }
            valid.push(profile as unknown as UserProfile);
          }
        }
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Search-result caching (whole result sets for filter combinations) ---

  async cacheSearchResults(
    filtersKey: string,
    partners: UserProfile[],
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<UserProfile[]> = {
      key: filtersKey,
      data: partners,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH, 'readwrite');
      tx.objectStore(STORE_SEARCH).put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedSearchResults(
    filtersKey: string,
  ): Promise<UserProfile[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH, 'readonly');
      const req = tx.objectStore(STORE_SEARCH).get(filtersKey);
      req.onsuccess = () => {
        const raw = req.result;
        if (!isRecord(raw)) {
          resolve(null);
          return;
        }
        const cachedAt = raw['cachedAt'];
        if (typeof cachedAt === 'number' && Date.now() - cachedAt < CACHE_TTL_MS) {
          const data = raw['data'];
          if (Array.isArray(data)) {
            resolve(data as unknown as UserProfile[]);
            return;
          }
        }
        resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** Build a deterministic key from filter parameters for cache indexing */
  buildFiltersKey(params: Record<string, unknown>): string {
    const sorted = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('&');
    return sorted || 'default';
  }

  // --- Clear ---

  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await indexedDB.deleteDatabase(DB_NAME);
      this.db = null;
      this.initPromise = null;
      this.cachedDataAvailable.set(false);
      if (this.isAvailable()) {
        this.initPromise = this.initDB();
        await this.initPromise;
        await this.refreshAvailability();
      }
    } catch {
      // Silently handle clear failures
    }
  }

  /**
   * Evicts stale cache entries older than CACHE_TTL_MS.
   * Call periodically (e.g., on app startup) to prevent unlimited IndexedDB growth.
   */
  async evictStaleEntries(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const cutoff = Date.now() - CACHE_TTL_MS;

    // Purge stale partner entries
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PARTNERS, 'readwrite');
      const store = tx.objectStore(STORE_PARTNERS);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const entry = cursor.value as (UserProfile & { _cachedAt?: number });
        if (entry._cachedAt && entry._cachedAt < cutoff) {
          void cursor.delete();
        }
        void cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Purge stale search result entries
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SEARCH, 'readwrite');
      const store = tx.objectStore(STORE_SEARCH);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const entry = cursor.value as CacheEntry<unknown>;
        if (entry.cachedAt < cutoff) {
          void cursor.delete();
        }
        void cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Re-check availability after cleanup
    void this.refreshAvailability();
  }
}