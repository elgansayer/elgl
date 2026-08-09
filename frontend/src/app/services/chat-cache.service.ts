import { Injectable, inject } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { ChatMessage, ChatRoom, FavouriteRecord } from './chat.service';

const DB_NAME = 'hellotalk_cache';
const DB_VERSION = 1;
const STORE_MESSAGES = 'chatMessages';
const STORE_ROOMS = 'chatRooms';
const STORE_FAVOURITES = 'chatFavourites';

const MESSAGES_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ROOMS_TTL_MS = 2 * 60 * 1000; // 2 minutes
const FAVOURITES_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise.catch(() => undefined);
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
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          db.createObjectStore(STORE_MESSAGES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_ROOMS)) {
          db.createObjectStore(STORE_ROOMS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_FAVOURITES)) {
          db.createObjectStore(STORE_FAVOURITES, { keyPath: 'key' });
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

  // --- Messages cache ---

  async cacheMessages(roomId: string, messages: ChatMessage[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<ChatMessage[]> = {
      key: roomId,
      data: messages,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.objectStore(STORE_MESSAGES).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedMessages(roomId: string): Promise<ChatMessage[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readonly');
      const req = tx.objectStore(STORE_MESSAGES).get(roomId);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<ChatMessage[]> | undefined;
        if (entry && Date.now() - entry.cachedAt < MESSAGES_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async invalidateMessages(roomId: string): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      tx.objectStore(STORE_MESSAGES).delete(roomId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Appends a single message to the cached message list for a room if the list exists.
   */
  async appendCachedMessage(roomId: string, message: ChatMessage): Promise<void> {
    const existing = await this.getCachedMessages(roomId);
    if (existing) {
      await this.cacheMessages(roomId, [...existing, message]);
    }
  }

  // --- Rooms cache ---

  async cacheRooms(rooms: ChatRoom[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<ChatRoom[]> = {
      key: 'all',
      data: rooms,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readwrite');
      tx.objectStore(STORE_ROOMS).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedRooms(): Promise<ChatRoom[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readonly');
      const req = tx.objectStore(STORE_ROOMS).get('all');
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<ChatRoom[]> | undefined;
        if (entry && Date.now() - entry.cachedAt < ROOMS_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async invalidateRooms(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readwrite');
      tx.objectStore(STORE_ROOMS).delete('all');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Favourites cache ---

  async cacheFavourites(favourites: FavouriteRecord[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry: CacheEntry<FavouriteRecord[]> = {
      key: 'all',
      data: favourites,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAVOURITES, 'readwrite');
      tx.objectStore(STORE_FAVOURITES).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedFavourites(): Promise<FavouriteRecord[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAVOURITES, 'readonly');
      const req = tx.objectStore(STORE_FAVOURITES).get('all');
      req.onsuccess = () => {
        const entry = req.result as CacheEntry<FavouriteRecord[]> | undefined;
        if (entry && Date.now() - entry.cachedAt < FAVOURITES_TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async invalidateFavourites(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FAVOURITES, 'readwrite');
      tx.objectStore(STORE_FAVOURITES).delete('all');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Full eviction ---

  async evictStaleEntries(): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const now = Date.now();

    const evictStore = (storeName: string, ttl: number): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          const entry = cursor.value as CacheEntry<unknown>;
          if (now - entry.cachedAt >= ttl) {
            void cursor.delete();
          }
          void cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

    await evictStore(STORE_MESSAGES, MESSAGES_TTL_MS);
    await evictStore(STORE_ROOMS, ROOMS_TTL_MS);
    await evictStore(STORE_FAVOURITES, FAVOURITES_TTL_MS);
  }
}