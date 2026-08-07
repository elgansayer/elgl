import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NetworkStatusService } from '../services/network-status.service';
import { ModerationItem } from '../services/moderation.service';

export interface ModerationActionRecord {
  id: string;
  itemId: string;
  action: 'approve' | 'reject';
  type: 'moment' | 'profile';
  reason?: string;
  queuedAt: number;
}

/**
 * Offline-aware service for the Admin Moderation Dashboard.
 * Caches moderation items in IndexedDB and queues approve/reject
 * actions for synchronisation when connectivity is restored.
 */
@Injectable({ providedIn: 'root' })
export class OfflineModerationService {
  private http = inject(HttpClient);
  private networkStatus = inject(NetworkStatusService);

  private readonly dbName = 'moderation_offline_db';
  private readonly itemsStore = 'cached_items';
  private readonly actionsStore = 'pending_actions';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Count of pending offline actions waiting to sync */
  readonly pendingActionCount = signal(0);

  /** Whether the most recent sync attempt failed */
  readonly lastSyncFailed = signal(false);

  get isOnline(): boolean {
    return this.networkStatus.isOnline();
  }

  constructor() {
    if (this.isBrowserWithIDB()) {
      this.initPromise = this.initDB();
      this.initPromise.then(() => this.refreshPendingCount()).catch(() => undefined);
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => this.syncPendingActions());
      }
    }
  }

  private isBrowserWithIDB(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest)) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(this.itemsStore)) {
          db.createObjectStore(this.itemsStore, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.actionsStore)) {
          const store = db.createObjectStore(this.actionsStore, { keyPath: 'id' });
          store.createIndex('byAction', 'action', { unique: false });
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
      const actions = await this.getPendingActions();
      this.pendingActionCount.set(actions.length);
    } catch { /* silently handle */ }
  }

  // ---- Item caching ----

  async cacheItems(items: ModerationItem[]): Promise<void> {
    if (!this.isBrowserWithIDB()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.itemsStore, 'readwrite');
      const store = tx.objectStore(this.itemsStore);
      store.clear();
      for (const item of items) store.put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedItems(type?: 'moment' | 'profile'): Promise<ModerationItem[]> {
    if (!this.isBrowserWithIDB()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.itemsStore, 'readonly');
      const store = tx.objectStore(this.itemsStore);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        if (type) resolve(all.filter((i: ModerationItem) => i.type === type));
        else resolve(all);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Action queueing ----

  async queueAction(
    itemId: string,
    action: 'approve' | 'reject',
    type: 'moment' | 'profile',
    reason?: string,
  ): Promise<void> {
    if (!this.isBrowserWithIDB()) return;
    await this.ensureDB();
    const record: ModerationActionRecord = {
      id: crypto.randomUUID(),
      itemId,
      action,
      type,
      reason,
      queuedAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.actionsStore, 'readwrite');
      const store = tx.objectStore(this.actionsStore);
      const request = store.put(record);
      request.onsuccess = () => {
        this.pendingActionCount.update((c) => c + 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingActions(): Promise<ModerationActionRecord[]> {
    if (!this.isBrowserWithIDB()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.actionsStore, 'readonly');
      const store = tx.objectStore(this.actionsStore);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removePendingAction(id: string): Promise<void> {
    if (!this.isBrowserWithIDB()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.actionsStore, 'readwrite');
      const store = tx.objectStore(this.actionsStore);
      const request = store.delete(id);
      request.onsuccess = () => {
        this.pendingActionCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeCachedItem(itemId: string): Promise<void> {
    if (!this.isBrowserWithIDB()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.itemsStore, 'readwrite');
      const store = tx.objectStore(this.itemsStore);
      const request = store.delete(itemId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ---- Sync ----

  /**
   * Syncs all pending approve/reject actions to the server.
   * Returns counts of successfully sent and failed actions.
   */
  async syncPendingActions(): Promise<{ sent: number; failed: number }> {
    if (!this.isOnline) return { sent: 0, failed: 0 };
    let sent = 0;
    let failed = 0;

    try {
      const actions = await this.getPendingActions();
      for (const action of actions) {
        try {
          if (action.action === 'approve') {
            await firstValueFrom(
              this.http.post(`${environment.apiUrl}/moderation/approve`, {
                itemId: action.itemId,
                type: action.type,
              }),
            );
          } else {
            await firstValueFrom(
              this.http.post(`${environment.apiUrl}/moderation/reject`, {
                itemId: action.itemId,
                type: action.type,
                reason: action.reason,
              }),
            );
          }
          await this.removePendingAction(action.id);
          sent++;
        } catch {
          failed++;
        }
      }
      this.lastSyncFailed.set(failed > 0);
    } catch {
      this.lastSyncFailed.set(true);
    }
    return { sent, failed };
  }
}