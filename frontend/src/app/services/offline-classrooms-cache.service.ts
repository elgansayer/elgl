import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { AudioRoomRecord } from './audio-rooms.store';

const DB_NAME = 'hellotalk_classrooms_cache';
const DB_VERSION = 1;
const STORE_ROOMS = 'rooms';
const STORE_LANGUAGE_GROUPS = 'languageGroups';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable({
  providedIn: 'root',
})
export class OfflineClassroomsCacheService {
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
          db.createObjectStore(STORE_ROOMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_LANGUAGE_GROUPS)) {
          db.createObjectStore(STORE_LANGUAGE_GROUPS, { keyPath: 'key' });
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

  // --- Room-level caching ---

  async cacheRoom(room: AudioRoomRecord): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readwrite');
      const entry = { ...room, _cachedAt: Date.now() };
      tx.objectStore(STORE_ROOMS).put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async cacheRooms(rooms: AudioRoomRecord[]): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readwrite');
      const store = tx.objectStore(STORE_ROOMS);
      for (const room of rooms) {
        store.put({ ...room, _cachedAt: Date.now() });
      }
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedRoom(roomId: string): Promise<AudioRoomRecord | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readonly');
      const req = tx.objectStore(STORE_ROOMS).get(roomId);
      req.onsuccess = () => {
        const entry = req.result as (AudioRoomRecord & { _cachedAt?: number }) | undefined;
        if (entry && entry._cachedAt && Date.now() - entry._cachedAt < CACHE_TTL_MS) {
          resolve(entry);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCachedRooms(): Promise<AudioRoomRecord[]> {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ROOMS, 'readonly');
      const req = tx.objectStore(STORE_ROOMS).getAll();
      req.onsuccess = () => {
        const entries = (req.result || []) as (AudioRoomRecord & { _cachedAt?: number })[];
        const valid = entries
          .filter((e) => e._cachedAt && Date.now() - e._cachedAt < CACHE_TTL_MS)
          .map(({ _cachedAt, ...rest }) => rest as AudioRoomRecord);
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Language-group caching ---

  async cacheLanguageGroups(
    groups: Array<{ language_pair: string; count: number; rooms: AudioRoomRecord[] }>,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANGUAGE_GROUPS, 'readwrite');
      const store = tx.objectStore(STORE_LANGUAGE_GROUPS);
      for (const group of groups) {
        store.put({ key: group.language_pair, data: group, cachedAt: Date.now() });
      }
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllCachedLanguageGroups(): Promise<
    Array<{ language_pair: string; count: number; rooms: AudioRoomRecord[] }>
  > {
    if (!this.isAvailable()) return [];
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_LANGUAGE_GROUPS, 'readonly');
      const req = tx.objectStore(STORE_LANGUAGE_GROUPS).getAll();
      req.onsuccess = () => {
        const entries = (req.result || []) as Array<{
          key: string;
          data: { language_pair: string; count: number; rooms: AudioRoomRecord[] };
          cachedAt: number;
        }>;
        const valid = entries
          .filter((e) => Date.now() - e.cachedAt < CACHE_TTL_MS)
          .map((e) => e.data);
        resolve(valid);
      };
      req.onerror = () => reject(req.error);
    });
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
}