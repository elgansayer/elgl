import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface CrashPayload {
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  adminContext?: AdminCrashContext;
}

export interface AdminCrashContext {
  route: string;
  component: string;
  adminRole: string;
  action?: string;
  offline: boolean;
}

export interface StoredCrashEntry {
  id: string;
  payload: CrashPayload;
  storedAt: number;
  synced: boolean;
}

const CRASH_STORE_NAME = 'admin_crashes';
const DB_NAME = 'hellotalk_crash_reports';
const DB_VERSION = 1;
const MAX_STORED_CRASHES = 50;
const MAX_CRASH_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable({ providedIn: 'root' })
export class CrashReportService {
  private apiService = inject(ApiService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly pendingCrashCount = signal(0);
  readonly lastCrash = signal<CrashPayload | null>(null);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.refreshPendingCount();
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest) || !target.result) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(CRASH_STORE_NAME)) {
          const store = db.createObjectStore(CRASH_STORE_NAME, { keyPath: 'id' });
          store.createIndex('storedAt', 'storedAt', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('Crash report IndexedDB not initialised');
    return this.db;
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  async reportCrash(
    error: Error,
    adminContext: AdminCrashContext,
    componentStack?: string,
  ): Promise<void> {
    const payload: CrashPayload = {
      message: error.message || 'Unknown crash error',
      name: error.name || 'Error',
      stack: error.stack,
      componentStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      adminContext,
    };

    this.lastCrash.set(payload);

    try {
      await this.sendCrashReport(payload);
    } catch {
      await this.storeCrashLocally(payload);
    }
  }

  private async sendCrashReport(payload: CrashPayload): Promise<void> {
    await this.apiService
      .post('/api/analytics/client-error', payload, { requireAuth: false })
      .catch(() => {
        throw new Error('Network reporting failed');
      });
  }

  private async storeCrashLocally(payload: CrashPayload): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;

    try {
      const db = await this.ensureDB();
      const entry: StoredCrashEntry = {
        id: `crash-${Date.now()}-${crypto.randomUUID()}`,
        payload,
        storedAt: Date.now(),
        synced: false,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CRASH_STORE_NAME, 'readwrite');
        tx.objectStore(CRASH_STORE_NAME).add(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      await this.pruneStoredCrashes();
      this.refreshPendingCount();
    } catch {
      // Cannot store locally either; last resort exhausted
    }
  }

  private async pruneStoredCrashes(): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    const db = await this.ensureDB();
    const cutoff = Date.now() - MAX_CRASH_AGE_MS;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(CRASH_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CRASH_STORE_NAME);
      const index = store.index('storedAt');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = async () => {
        const allEntries = await this.getAllCrashesRaw(db);
        if (allEntries.length > MAX_STORED_CRASHES) {
          const sorted = allEntries.sort((a, b) => a.storedAt - b.storedAt);
          const toDelete = sorted.slice(0, sorted.length - MAX_STORED_CRASHES);
          const deleteTx = db.transaction(CRASH_STORE_NAME, 'readwrite');
          const deleteStore = deleteTx.objectStore(CRASH_STORE_NAME);
          for (const entry of toDelete) {
            deleteStore.delete(entry.id);
          }
          deleteTx.oncomplete = () => resolve();
          deleteTx.onerror = () => reject(deleteTx.error);
        } else {
          resolve();
        }
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private getAllCrashesRaw(db: IDBDatabase): Promise<StoredCrashEntry[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CRASH_STORE_NAME, 'readonly');
      const request = tx.objectStore(CRASH_STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async syncPendingCrashes(): Promise<number> {
    if (!this.isIndexedDBAvailable()) return 0;

    try {
      const db = await this.ensureDB();
      const unsynced = await this.getUnsyncedCrashes(db);
      let synced = 0;

      for (const entry of unsynced) {
        try {
          await this.sendCrashReport(entry.payload);
          await this.markCrashSynced(db, entry.id);
          synced++;
        } catch {
          // Will retry on next sync
          break;
        }
      }

      this.refreshPendingCount();
      return synced;
    } catch {
      return 0;
    }
  }

  private getUnsyncedCrashes(db: IDBDatabase): Promise<StoredCrashEntry[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CRASH_STORE_NAME, 'readonly');
      const index = tx.objectStore(CRASH_STORE_NAME).index('synced');
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private markCrashSynced(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CRASH_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CRASH_STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const entry = getReq.result as StoredCrashEntry;
        if (entry) {
          entry.synced = true;
          store.put(entry);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async refreshPendingCount(): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    try {
      const db = await this.ensureDB();
      const unsynced = await this.getUnsyncedCrashes(db);
      this.pendingCrashCount.set(unsynced.length);
    } catch {
      this.pendingCrashCount.set(0);
    }
  }

  async getCrashHistory(limit = 20): Promise<StoredCrashEntry[]> {
    if (!this.isIndexedDBAvailable()) return [];
    try {
      const db = await this.ensureDB();
      const all = await this.getAllCrashesRaw(db);
      return all.sort((a, b) => b.storedAt - a.storedAt).slice(0, limit);
    } catch {
      return [];
    }
  }

  async clearAllCrashes(): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    try {
      const db = await this.ensureDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(CRASH_STORE_NAME, 'readwrite');
        tx.objectStore(CRASH_STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      this.pendingCrashCount.set(0);
    } catch {
      // Silently handle clear failures
    }
  }
}
