import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { AudioRoomRecord } from './audio-rooms.store';

const DB_NAME = 'hellotalk_video_classroom_offline';
const DB_VERSION = 1;
const STORE_ROOMS = 'classrooms';
const STORE_ROOM_DETAIL = 'room_details';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
}

/**
 * Provides IndexedDB-backed offline persistence for the Video Classrooms feature.
 * Caches the classroom marketplace listing and individual room details so that
 * users can browse previously fetched classrooms while offline.
 */
@Injectable({
  providedIn: 'root',
})
export class OfflineVideoClassroomService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly isOnline = this.networkStatus.isOnline;
  /** Whether we are currently serving cached/offline data */
  readonly isOfflineMode = signal(false);
  /** Indicates whether the user has any cached classroom data available */
  readonly cachedDataAvailable = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshAvailability())
        .catch(() => undefined);
      this.syncOnlineStatus();
    }
  }

  private syncOnlineStatus(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleStatusChange);
      window.addEventListener('offline', this.handleStatusChange);
    }
    this.handleStatusChange();
  }

  private readonly handleStatusChange = (): void => {
    const online = this.isOnline();
    this.isOfflineMode.set(!online);
  };

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
        if (!(target instanceof IDBOpenDBRequest)) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_ROOMS)) {
          db.createObjectStore(STORE_ROOMS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_ROOM_DETAIL)) {
          db.createObjectStore(STORE_ROOM_DETAIL, { keyPath: 'id' });
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
      const db = await this.ensureDB();
      const all = await this.getAllFromStore(db, STORE_ROOMS);
      const hasValid = (all as CacheEntry<unknown>[]).some(
        (e) => Date.now() - e.cachedAt < CACHE_TTL_MS,
      );
      this.cachedDataAvailable.set(hasValid);
    } catch {
      this.cachedDataAvailable.set(false);
    }
  }

  // --- Classroom listing caching ---

  /**
   * Cache the full classroom marketplace listing. Uses a single sentinel key
   * so there is a single source of truth for the listing data.
   */
  async cacheClassroomListing(
    rooms: AudioRoomRecord[],
    filterKey = 'all',
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<AudioRoomRecord[]> = {
      key: `listing_${filterKey}`,
      data: rooms,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readwrite');
      void tx.objectStore(STORE_ROOMS).put(entry as unknown as Record<string, unknown>);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieve the last cached classroom listing (optionally filtered by language).
   * Returns null if no fresh cache entry exists.
   */
  async getCachedClassroomListing(filterKey = 'all'): Promise<AudioRoomRecord[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readonly');
      const req = tx.objectStore(STORE_ROOMS).get(`listing_${filterKey}`);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<AudioRoomRecord[]> | undefined;
        if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Individual room detail caching ---

  /**
   * Cache individual classroom details for offline viewing.
   */
  async cacheRoomDetail(room: AudioRoomRecord): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<AudioRoomRecord> = {
      key: room.id,
      data: room,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOM_DETAIL, 'readwrite');
      void tx.objectStore(STORE_ROOM_DETAIL).put(entry as unknown as Record<string, unknown>);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieve a single cached room detail entry.
   */
  async getCachedRoomDetail(roomId: string): Promise<AudioRoomRecord | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOM_DETAIL, 'readonly');
      const req = tx.objectStore(STORE_ROOM_DETAIL).get(roomId);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<AudioRoomRecord> | undefined;
        if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Eviction and cleanup ---

  /**
   * Evicts stale cache entries older than CACHE_TTL_MS.
   */
  async evictStaleEntries(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const cutoff = Date.now() - CACHE_TTL_MS;

    await this.purgeStaleInStore(db, STORE_ROOMS, cutoff);
    await this.purgeStaleInStore(db, STORE_ROOM_DETAIL, cutoff);

    void this.refreshAvailability();
  }

  private purgeStaleInStore(
    db: IDBDatabase,
    storeName: string,
    cutoff: number,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
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
  }

  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await indexedDB.deleteDatabase(DB_NAME);
      this.db = null;
      this.initPromise = null;
      this.cachedDataAvailable.set(false);
      this.isOfflineMode.set(false);
      if (this.isAvailable()) {
        this.initPromise = this.initDB();
        await this.initPromise;
        await this.refreshAvailability();
      }
    } catch {
      // Silently handle clear failures
    }
  }

  // --- IDB helpers ---

  private getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
      const store = db.transaction(storeName, 'readonly').objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
}