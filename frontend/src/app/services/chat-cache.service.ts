import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import type { ChatMessage, ChatRoom, FavouriteRecord } from './chat.service';

const DB_NAME = 'hellotalk_cache';
const DB_VERSION = 1;
const STORE_MESSAGES = 'chatMessages';
const STORE_ROOMS = 'chatRooms';
const STORE_FAVOURITES = 'chatFavourites';
const CACHE_KEY_VERSION = 'v2';

const MESSAGES_TTL_MS = 5 * 60 * 1000;
const ROOMS_TTL_MS = 2 * 60 * 1000;
const FAVOURITES_TTL_MS = 10 * 60 * 1000;
const OFFLINE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_MESSAGES_PER_ROOM = 500;
const MAX_ROOMS = 250;
const MAX_FAVOURITES = 500;

interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number;
}

interface ReadOptions {
  ttlMs: number;
  maxItems: number;
  keepNewest?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ChatCacheService {
  private readonly authService = inject(AuthService);
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (this.isAvailable()) {
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
        this.db.onversionchange = () => {
          this.db?.close();
          this.db = null;
        };
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

  private scopedKey(kind: string, id = 'all'): string | null {
    const userId = this.authService.currentUser()?.id?.trim();
    if (!userId) return null;
    return `${CACHE_KEY_VERSION}:${encodeURIComponent(userId)}:${kind}:${encodeURIComponent(id)}`;
  }

  private isUsableEntry<T>(value: unknown): value is CacheEntry<T[]> {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<CacheEntry<unknown>>;
    return (
      typeof entry.key === 'string' &&
      entry.key.startsWith(`${CACHE_KEY_VERSION}:`) &&
      typeof entry.cachedAt === 'number' &&
      Number.isFinite(entry.cachedAt) &&
      Array.isArray(entry.data)
    );
  }

  private async readArray<T>(
    storeName: string,
    key: string | null,
    options: ReadOptions,
  ): Promise<T[] | null> {
    if (!key || !this.isAvailable()) return null;

    try {
      const db = await this.ensureDB();
      const entry = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.onabort = () => reject(tx.error);
      });

      if (!this.isUsableEntry<T>(entry)) return null;

      const ageMs = Math.max(0, Date.now() - entry.cachedAt);
      const maxAgeMs = this.networkStatus.isOnline() ? options.ttlMs : OFFLINE_RETENTION_MS;
      if (ageMs >= maxAgeMs) return null;

      return options.keepNewest
        ? entry.data.slice(-options.maxItems)
        : entry.data.slice(0, options.maxItems);
    } catch {
      // Cache availability must never prevent chat from falling back to the network.
      return null;
    }
  }

  private async writeArray<T>(
    storeName: string,
    key: string | null,
    data: T[],
    maxItems: number,
    keepNewest = false,
  ): Promise<void> {
    if (!key || !this.isAvailable()) return;

    const boundedData = keepNewest ? data.slice(-maxItems) : data.slice(0, maxItems);
    const entry: CacheEntry<T[]> = {
      key,
      data: boundedData,
      cachedAt: Date.now(),
    };

    try {
      const db = await this.ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // IndexedDB can be unavailable because of privacy mode, quota, or browser policy.
      // Caching is an optimization, so callers continue without persisted cache state.
    }
  }

  private async deleteKey(storeName: string, key: string | null): Promise<void> {
    if (!key || !this.isAvailable()) return;

    try {
      const db = await this.ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } catch {
      // Invalidation is best-effort. A failed cache delete must not block the mutation.
    }
  }

  // --- Messages cache ---

  async cacheMessages(roomId: string, messages: ChatMessage[]): Promise<void> {
    await this.writeArray(
      STORE_MESSAGES,
      this.scopedKey('messages', roomId),
      messages,
      MAX_MESSAGES_PER_ROOM,
      true,
    );
  }

  async getCachedMessages(roomId: string): Promise<ChatMessage[] | null> {
    return this.readArray<ChatMessage>(STORE_MESSAGES, this.scopedKey('messages', roomId), {
      ttlMs: MESSAGES_TTL_MS,
      maxItems: MAX_MESSAGES_PER_ROOM,
      keepNewest: true,
    });
  }

  async invalidateMessages(roomId: string): Promise<void> {
    await this.deleteKey(STORE_MESSAGES, this.scopedKey('messages', roomId));
  }

  /**
   * Adds or replaces a message in an existing cached room snapshot.
   * Duplicate realtime/API echoes therefore keep one canonical message ID.
   */
  async appendCachedMessage(roomId: string, message: ChatMessage): Promise<void> {
    const existing = await this.getCachedMessages(roomId);
    if (!existing) return;

    const index = existing.findIndex((cachedMessage) => cachedMessage.id === message.id);
    if (index >= 0) {
      existing[index] = message;
    } else {
      existing.push(message);
    }
    await this.cacheMessages(roomId, existing);
  }

  // --- Rooms cache ---

  async cacheRooms(rooms: ChatRoom[]): Promise<void> {
    await this.writeArray(
      STORE_ROOMS,
      this.scopedKey('rooms'),
      rooms,
      MAX_ROOMS,
    );
  }

  async getCachedRooms(): Promise<ChatRoom[] | null> {
    return this.readArray<ChatRoom>(STORE_ROOMS, this.scopedKey('rooms'), {
      ttlMs: ROOMS_TTL_MS,
      maxItems: MAX_ROOMS,
    });
  }

  async invalidateRooms(): Promise<void> {
    await this.deleteKey(STORE_ROOMS, this.scopedKey('rooms'));
  }

  // --- Favourites cache ---

  async cacheFavourites(favourites: FavouriteRecord[]): Promise<void> {
    await this.writeArray(
      STORE_FAVOURITES,
      this.scopedKey('favourites'),
      favourites,
      MAX_FAVOURITES,
    );
  }

  async getCachedFavourites(): Promise<FavouriteRecord[] | null> {
    return this.readArray<FavouriteRecord>(STORE_FAVOURITES, this.scopedKey('favourites'), {
      ttlMs: FAVOURITES_TTL_MS,
      maxItems: MAX_FAVOURITES,
    });
  }

  async invalidateFavourites(): Promise<void> {
    await this.deleteKey(STORE_FAVOURITES, this.scopedKey('favourites'));
  }

  // --- Full eviction ---

  async evictStaleEntries(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const db = await this.ensureDB();
      const now = Date.now();

      const evictStore = (storeName: string): Promise<void> =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) return;
            const entry = cursor.value as Partial<CacheEntry<unknown>>;
            const isCurrentScopedEntry =
              typeof entry.key === 'string' && entry.key.startsWith(`${CACHE_KEY_VERSION}:`);
            const cachedAt = entry.cachedAt;
            const isExpired =
              typeof cachedAt !== 'number' ||
              !Number.isFinite(cachedAt) ||
              Math.max(0, now - cachedAt) >= OFFLINE_RETENTION_MS;
            if (!isCurrentScopedEntry || isExpired) {
              void cursor.delete();
            }
            void cursor.continue();
          };
          req.onerror = () => reject(req.error);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });

      await evictStore(STORE_MESSAGES);
      await evictStore(STORE_ROOMS);
      await evictStore(STORE_FAVOURITES);
    } catch {
      // Best-effort housekeeping only; chat remains usable when IndexedDB is unavailable.
    }
  }
}
