import { Injectable, signal, inject } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import type {
  AdminUserSummary,
  AdminBlockEntry,
  LoginHistoryEntry,
} from './admin.service';
import type { ModerationItem } from './moderation.service';

type StoreName = 'adminUsers' | 'adminBlocks' | 'moderationItems' | 'loginHistory';
const DB_NAME = 'hellotalk_admin_offline';
const DB_VERSION = 1;

interface CachedPage<T> {
  key: string;
  data: T[];
  total: number;
  cachedAt: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineAdminStorageService {
  private networkStatus = inject(NetworkStatusService);
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
        const stores: StoreName[] = [
          'adminUsers',
          'adminBlocks',
          'moderationItems',
          'loginHistory',
        ];
        for (const name of stores) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'key' });
          }
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

  // ─── Admin Users ────────────────────────────────────────────────

  async cacheUsers(
    search: string,
    page: number,
    pageSize: number,
    users: AdminUserSummary[],
    total: number,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const key = this.usersKey(search, page, pageSize);
    const entry: CachedPage<AdminUserSummary> = {
      key,
      data: users,
      total,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('adminUsers', 'readwrite');
      tx.objectStore('adminUsers').put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedUsers(
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{ users: AdminUserSummary[]; total: number } | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    const key = this.usersKey(search, page, pageSize);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('adminUsers', 'readonly');
      const req = tx.objectStore('adminUsers').get(key);
      req.onsuccess = () => {
        const entry = req.result as CachedPage<AdminUserSummary> | undefined;
        if (entry && Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000) {
          resolve({ users: entry.data, total: entry.total });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Admin Blocks ───────────────────────────────────────────────

  async cacheBlocks(
    page: number,
    pageSize: number,
    blocks: AdminBlockEntry[],
    total: number,
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const key = this.blocksKey(page, pageSize);
    const entry: CachedPage<AdminBlockEntry> = {
      key,
      data: blocks,
      total,
      cachedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('adminBlocks', 'readwrite');
      tx.objectStore('adminBlocks').put(entry);
      tx.oncomplete = () => {
        this.cachedDataAvailable.set(true);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedBlocks(
    page: number,
    pageSize: number,
  ): Promise<{ blocks: AdminBlockEntry[]; total: number } | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    const key = this.blocksKey(page, pageSize);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('adminBlocks', 'readonly');
      const req = tx.objectStore('adminBlocks').get(key);
      req.onsuccess = () => {
        const entry = req.result as CachedPage<AdminBlockEntry> | undefined;
        if (entry && Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000) {
          resolve({ blocks: entry.data, total: entry.total });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Login History ──────────────────────────────────────────────

  async cacheLoginHistory(
    userId: string,
    entries: LoginHistoryEntry[],
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const entry = { key: `user:${userId}`, data: entries, cachedAt: Date.now() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loginHistory', 'readwrite');
      tx.objectStore('loginHistory').put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedLoginHistory(
    userId: string,
  ): Promise<LoginHistoryEntry[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loginHistory', 'readonly');
      const req = tx.objectStore('loginHistory').get(`user:${userId}`);
      req.onsuccess = () => {
        const entry = req.result as { data: LoginHistoryEntry[]; cachedAt: number } | undefined;
        if (entry && Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Moderation Items ───────────────────────────────────────────

  async cacheModerationItems(
    type: string,
    status: string | undefined,
    items: ModerationItem[],
  ): Promise<void> {
    if (!this.isAvailable()) return;
    const db = await this.ensureDB();
    const key = `type:${type}:status:${status ?? 'all'}`;
    const entry = { key, data: items, cachedAt: Date.now() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('moderationItems', 'readwrite');
      tx.objectStore('moderationItems').put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedModerationItems(
    type: string,
    status: string | undefined,
  ): Promise<ModerationItem[] | null> {
    if (!this.isAvailable()) return null;
    const db = await this.ensureDB();
    const key = `type:${type}:status:${status ?? 'all'}`;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('moderationItems', 'readonly');
      const req = tx.objectStore('moderationItems').get(key);
      req.onsuccess = () => {
        const entry = req.result as { data: ModerationItem[]; cachedAt: number } | undefined;
        if (entry && Date.now() - entry.cachedAt < 24 * 60 * 60 * 1000) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Clear ──────────────────────────────────────────────────────

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

  // ─── Key helpers ────────────────────────────────────────────────

  private usersKey(search: string, page: number, pageSize: number): string {
    return `search:${search.trim().toLowerCase()}:page:${page}:size:${pageSize}`;
  }

  private blocksKey(page: number, pageSize: number): string {
    return `page:${page}:size:${pageSize}`;
  }
}