import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';

const DB_NAME = 'hellotalk_chat_cache';
const DB_VERSION = 1;
const STORE_ROOMS = 'rooms';
const STORE_MESSAGES = 'messages';
const STORE_FAVOURITES = 'favourites';
const STORE_MEMBERS = 'members';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatCacheService {
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
        if (!(target instanceof IDBOpenDBRequest)) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_ROOMS)) {
          db.createObjectStore(STORE_ROOMS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          db.createObjectStore(STORE_MESSAGES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_FAVOURITES)) {
          db.createObjectStore(STORE_FAVOURITES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_MEMBERS)) {
          db.createObjectStore(STORE_MEMBERS, { keyPath: 'key' });
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

  private async getCached<T>(storeName: string, key: string, ttlMs = DEFAULT_TTL_MS): Promise<T | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        if (entry && Date.now() - entry.cachedAt < ttlMs) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async setCached<T>(storeName: string, key: string, data: T): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<T> = { key, data, cachedAt: Date.now() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private async removeCached(storeName: string, key: string): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---- Rooms cache ----

  async cacheRooms(rooms: unknown[]): Promise<void> {
    await this.setCached(STORE_ROOMS, 'all', rooms);
  }

  async getCachedRooms(): Promise<unknown[] | null> {
    return this.getCached<unknown[]>(STORE_ROOMS, 'all');
  }

  // ---- Messages cache (per room) ----

  async cacheMessages(roomId: string, messages: unknown[]): Promise<void> {
    await this.setCached(STORE_MESSAGES, roomId, messages);
  }

  async getCachedMessages(roomId: string): Promise<unknown[] | null> {
    return this.getCached<unknown[]>(STORE_MESSAGES, roomId);
  }

  async invalidateMessages(roomId: string): Promise<void> {
    await this.removeCached(STORE_MESSAGES, roomId);
  }

  // ---- Favourites cache ----

  async cacheFavourites(favourites: unknown[]): Promise<void> {
    await this.setCached(STORE_FAVOURITES, 'all', favourites);
  }

  async getCachedFavourites(): Promise<unknown[] | null> {
    return this.getCached<unknown[]>(STORE_FAVOURITES, 'all');
  }

  async invalidateFavourites(): Promise<void> {
    await this.removeCached(STORE_FAVOURITES, 'all');
  }

  // ---- Room members cache ----

  async cacheRoomMembers(roomId: string, members: unknown[]): Promise<void> {
    await this.setCached(STORE_MEMBERS, roomId, members);
  }

  async getCachedRoomMembers(roomId: string): Promise<unknown[] | null> {
    return this.getCached<unknown[]>(STORE_MEMBERS, roomId);
  }

  // ---- Eviction & clear ----

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

  async evictStaleEntries(ttlMs = DEFAULT_TTL_MS): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const cutoff = Date.now() - ttlMs;
    const stores = [STORE_ROOMS, STORE_MESSAGES, STORE_FAVOURITES, STORE_MEMBERS];

    for (const storeName of stores) {
      await new Promise<void>((resolve, reject) => {
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

    void this.refreshAvailability();
  }
}