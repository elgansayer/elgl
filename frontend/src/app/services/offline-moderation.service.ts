import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { ModerationItem, ModerationActionResponse } from './moderation.service';

const DB_NAME = 'hellotalk_moderation_offline';
const DB_VERSION = 1;
const STORE_ITEMS = 'moderation_items';
const STORE_ACTIONS = 'pending_actions';

interface CachedModerationItems {
  type: 'moment' | 'profile';
  items: ModerationItem[];
  timestamp: number;
}

interface PendingModerationAction {
  id: string;
  actionType: 'approve' | 'reject';
  itemId: string;
  itemType: 'moment' | 'profile';
  reason?: string;
  createdAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineModerationService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  readonly isOfflineMode = signal(false);
  readonly pendingActionCount = signal(0);

  constructor() {
    if (typeof indexedDB === 'undefined') return;
    this.initPromise = this.initDB();
    this.syncOnlineStatus();
  }

  private syncOnlineStatus(): void {
    const handleStatusChange = (): void => {
      const online = this.networkStatus.isOnline();
      this.isOfflineMode.set(!online);
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
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          db.createObjectStore(STORE_ITEMS, { keyPath: 'type' });
        }
        if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
          db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (this.initPromise) await this.initPromise;
    if (!this.db) throw new Error('IndexedDB not initialised');
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const pending = await this.getPendingActions();
      this.pendingActionCount.set(pending.length);
    } catch {
      // silently ignore
    }
  }

  // --- Cache moderation items ---

  async cacheItems(type: 'moment' | 'profile', items: ModerationItem[]): Promise<void> {
    await this.ensureDB();
    const cache: CachedModerationItems = { type, items, timestamp: Date.now() };
    return this.putInStore(STORE_ITEMS, cache as unknown as Record<string, unknown>);
  }

  async getCachedItems(type: 'moment' | 'profile'): Promise<ModerationItem[]> {
    await this.ensureDB();
    const cached = await this.getFromStore<CachedModerationItems>(STORE_ITEMS, type);
    if (!cached) return [];
    return cached.items;
  }

  // --- Pending action queue for offline moderation ---

  async enqueuePendingAction(
    actionType: PendingModerationAction['actionType'],
    itemId: string,
    itemType: 'moment' | 'profile',
    reason?: string,
  ): Promise<string> {
    await this.ensureDB();
    const id = `mod_${Date.now()}_${crypto.randomUUID()}`;
    const action: PendingModerationAction = {
      id,
      actionType,
      itemId,
      itemType,
      reason,
      createdAt: Date.now(),
    };
    await this.putInStore(STORE_ACTIONS, action as unknown as Record<string, unknown>);
    await this.refreshPendingCount();
    return id;
  }

  async getPendingActions(): Promise<PendingModerationAction[]> {
    await this.ensureDB();
    const all = await this.getAllFromStore<Record<string, unknown>>(STORE_ACTIONS);
    return all
      .filter(
        (item) => typeof item['actionType'] === 'string' && typeof item['itemId'] === 'string',
      )
      .map((item) => item as unknown as PendingModerationAction);
  }

  async removePendingAction(id: string): Promise<void> {
    await this.ensureDB();
    await this.deleteFromStore(STORE_ACTIONS, id);
    await this.refreshPendingCount();
  }

  /** Process all pending actions against the online API and clear the queue. */
  async syncPendingActions(
    executor: (action: PendingModerationAction) => Promise<ModerationActionResponse>,
  ): Promise<{ succeeded: number; failed: number }> {
    const pending = await this.getPendingActions();
    let succeeded = 0;
    let failed = 0;
    for (const action of pending) {
      const result = await executor(action);
      if (result.success) {
        await this.removePendingAction(action.id);
        succeeded++;
      } else {
        failed++;
      }
    }
    return { succeeded, failed };
  }

  async clearAll(): Promise<void> {
    await this.ensureDB();
    await Promise.all([this.clearStore(STORE_ITEMS), this.clearStore(STORE_ACTIONS)]);
    this.isOfflineMode.set(false);
    this.pendingActionCount.set(0);
  }

  // --- Generic IDB helpers ---

  private putInStore(storeName: string, value: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private getFromStore<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  private getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  private deleteFromStore(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  private clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}
