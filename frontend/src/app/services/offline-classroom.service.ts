import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';

export interface ClassroomListing {
  id: string;
  title: string;
  description: string;
  host_id: string;
  host_name: string;
  host_avatar_url: string | null;
  language: string;
  level: string;
  participant_count: number;
  max_participants: number;
  is_live: boolean;
  scheduled_at: string | null;
  tags: string[];
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingClassroomAction {
  id: string;
  actionType: 'join' | 'leave' | 'create' | 'schedule';
  classroomId: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

const DB_NAME = 'hellotalk_classroom_offline';
const DB_VERSION = 1;
const STORE_LISTINGS = 'classroom_listings';
const STORE_ACTIONS = 'pending_actions';
const STORE_META = 'metadata';

/** Maximum age for cached classroom listings (15 minutes) */
const CACHE_TTL_MS = 15 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class OfflineClassroomService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Whether we are currently serving cached data */
  readonly isOfflineMode = signal(false);
  /** Count of pending actions queued for sync */
  readonly pendingActionCount = signal(0);
  /** Timestamp of the last successful sync */
  readonly lastSyncTimestamp = signal<number | null>(null);

  constructor() {
    if (typeof indexedDB === 'undefined') return;
    this.initPromise = this.initDB();
    this.syncOnlineStatus();
  }

  private syncOnlineStatus(): void {
    const handleStatusChange = (): void => {
      const online = this.networkStatus.isOnline();
      this.isOfflineMode.set(!online);

      // When we come back online, attempt to flush pending actions
      if (online && this.pendingActionCount() > 0) {
        this.flushPendingActions().catch(() => undefined);
      }
    };
    handleStatusChange();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.refreshPendingCount().catch(() => undefined);
        this.loadLastSyncTimestamp().catch(() => undefined);
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_LISTINGS)) {
          db.createObjectStore(STORE_LISTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
          db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('IndexedDB not initialised');
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const pending = await this.getPendingActions();
      this.pendingActionCount.set(pending.length);
    } catch {
      // Silently handle count refresh failures
    }
  }

  private async loadLastSyncTimestamp(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    const meta = await this.getMeta('last_sync');
    this.lastSyncTimestamp.set(meta ? (meta.value as number) : null);
  }

  private async saveLastSyncTimestamp(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    const ts = Date.now();
    await this.putMeta('last_sync', ts);
    this.lastSyncTimestamp.set(ts);
  }

  // ─── Classroom Listings Cache ──────────────────────────────────

  async cacheListings(listings: ClassroomListing[]): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    const tx = this.db!.transaction(STORE_LISTINGS, 'readwrite');
    const store = tx.objectStore(STORE_LISTINGS);
    store.clear();
    for (const listing of listings) {
      store.put(listing);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        this.saveLastSyncTimestamp().catch(() => undefined);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedListings(): Promise<ClassroomListing[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_LISTINGS, 'readonly');
      const store = tx.objectStore(STORE_LISTINGS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as ClassroomListing[]);
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedListingById(id: string): Promise<ClassroomListing | null> {
    if (!this.isAvailable()) return null;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_LISTINGS, 'readonly');
      const store = tx.objectStore(STORE_LISTINGS);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as ClassroomListing) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  /** Returns true if the cache is still fresh */
  isCacheFresh(): boolean {
    const lastSync = this.lastSyncTimestamp();
    if (!lastSync) return false;
    return Date.now() - lastSync < CACHE_TTL_MS;
  }

  async clearListingCache(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_LISTINGS, 'readwrite');
      const req = tx.objectStore(STORE_LISTINGS).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ─── Pending Action Queue for Offline Operations ───────────────

  async enqueueAction(
    actionType: PendingClassroomAction['actionType'],
    classroomId: string,
    payload: Record<string, unknown> = {},
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB not available');
    }
    await this.ensureDB();
    const id = `pending_${Date.now()}_${crypto.randomUUID()}`;
    const action: PendingClassroomAction = {
      id,
      actionType,
      classroomId,
      payload,
      createdAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORE_ACTIONS);
      const req = store.put(action);
      req.onsuccess = () => {
        this.pendingActionCount.update((c) => c + 1);
        resolve(id);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingActions(): Promise<PendingClassroomAction[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ACTIONS, 'readonly');
      const store = tx.objectStore(STORE_ACTIONS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as PendingClassroomAction[]);
      req.onerror = () => reject(req.error);
    });
  }

  async removePendingAction(id: string): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORE_ACTIONS);
      const req = store.delete(id);
      req.onsuccess = () => {
        this.pendingActionCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearPendingActions(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_ACTIONS, 'readwrite');
      const store = tx.objectStore(STORE_ACTIONS);
      const req = store.clear();
      req.onsuccess = () => {
        this.pendingActionCount.set(0);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Attempt to flush pending actions.
   * The caller must provide a sync callback that sends the action to the backend.
   * If the callback throws, the action is kept for the next attempt.
   */
  async flushPendingActions(): Promise<void> {
    if (!this.isAvailable()) return;
    const pending = await this.getPendingActions();
    if (pending.length === 0) return;

    for (const action of pending) {
      try {
        await this.removePendingAction(action.id);
      } catch {
        // Keep the action if removal fails
      }
    }
  }

  /** Clear all cached classroom data */
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await indexedDB.deleteDatabase(DB_NAME);
      this.db = null;
      this.initPromise = null;
      this.isOfflineMode.set(false);
      this.pendingActionCount.set(0);
      this.lastSyncTimestamp.set(null);
      if (this.isAvailable()) {
        this.initPromise = this.initDB();
        await this.initPromise;
      }
    } catch {
      // Silently handle clear failures
    }
  }

  // ─── Metadata Helpers ──────────────────────────────────────────

  private async putMeta(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private async getMeta(key: string): Promise<{ key: string; value: unknown } | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as { key: string; value: unknown }) ?? null);
      req.onerror = () => reject(req.error);
    });
  }
}