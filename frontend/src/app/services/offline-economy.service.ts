import { Injectable, inject, signal } from '@angular/core';
import { NetworkStatusService } from './network-status.service';
import { VirtualGift, CoinPackage, StickerPack } from './economy.store';

const DB_NAME = 'hellotalk_economy_offline';
const DB_VERSION = 1;
const STORE_CATALOG = 'catalog';
const STORE_PACKAGES = 'coin_packages';
const STORE_STICKERS = 'sticker_packs';
const STORE_STATE = 'state';

interface CachedEconomyState {
  coinsBalance: number;
  timestamp: number;
}

interface PendingEconomyAction {
  id: string;
  actionType: 'send_gift' | 'unlock_sticker' | 'purchase_coins';
  payload: Record<string, unknown>;
  createdAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class OfflineEconomyService {
  private readonly networkStatus = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Whether we're currently serving cached data */
  readonly isOfflineMode = signal(false);
  /** Count of pending actions queued for sync */
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
        const target = event.target;
        if (!(target instanceof IDBOpenDBRequest) || !target.result) return;
        const db = target.result;
        if (!db.objectStoreNames.contains(STORE_CATALOG)) {
          db.createObjectStore(STORE_CATALOG, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PACKAGES)) {
          db.createObjectStore(STORE_PACKAGES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_STICKERS)) {
          db.createObjectStore(STORE_STICKERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_STATE)) {
          db.createObjectStore(STORE_STATE, { keyPath: 'key' });
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

  // --- Cache economy state ---

  async cacheBalance(balance: number): Promise<void> {
    await this.ensureDB();
    const state: CachedEconomyState = { coinsBalance: balance, timestamp: Date.now() };
    return this.putInStore(STORE_STATE, { key: 'economy', ...state });
  }

  async getCachedBalance(): Promise<CachedEconomyState | null> {
    await this.ensureDB();
    return this.getFromStore<CachedEconomyState>(STORE_STATE, 'economy');
  }

  async cacheCatalog(catalog: VirtualGift[]): Promise<void> {
    await this.ensureDB();
    await this.clearStore(STORE_CATALOG);
    await Promise.all(catalog.map((g) => this.putInStore(STORE_CATALOG, g)));
  }

  async getCachedCatalog(): Promise<VirtualGift[]> {
    await this.ensureDB();
    return this.getAllFromStore<VirtualGift>(STORE_CATALOG);
  }

  async cacheCoinPackages(packages: CoinPackage[]): Promise<void> {
    await this.ensureDB();
    await this.clearStore(STORE_PACKAGES);
    await Promise.all(packages.map((p) => this.putInStore(STORE_PACKAGES, p)));
  }

  async getCachedCoinPackages(): Promise<CoinPackage[]> {
    await this.ensureDB();
    return this.getAllFromStore<CoinPackage>(STORE_PACKAGES);
  }

  async cacheStickerPacks(packs: StickerPack[]): Promise<void> {
    await this.ensureDB();
    await this.clearStore(STORE_STICKERS);
    await Promise.all(packs.map((p) => this.putInStore(STORE_STICKERS, p)));
  }

  async getCachedStickerPacks(): Promise<StickerPack[]> {
    await this.ensureDB();
    return this.getAllFromStore<StickerPack>(STORE_STICKERS);
  }

  // --- Pending action queue for offline transactions ---

  async enqueuePendingAction(
    actionType: PendingEconomyAction['actionType'],
    payload: Record<string, unknown>,
  ): Promise<string> {
    await this.ensureDB();
    const id = `pending_${Date.now()}_${crypto.randomUUID()}`;
    const action: PendingEconomyAction = {
      id,
      actionType,
      payload,
      createdAt: Date.now(),
    };
    await this.putInStore(STORE_STATE, { key: id, ...action });
    await this.refreshPendingCount();
    return id;
  }

  async getPendingActions(): Promise<PendingEconomyAction[]> {
    await this.ensureDB();
    const all = await this.getAllFromStore<Record<string, unknown>>(STORE_STATE);
    return all
      .filter(
        (item) => typeof item['actionType'] === 'string' && typeof item['payload'] === 'object',
      )
      .map((item) => item as unknown as PendingEconomyAction);
  }

  async removePendingAction(id: string): Promise<void> {
    await this.ensureDB();
    await this.deleteFromStore(STORE_STATE, id);
    await this.refreshPendingCount();
  }

  async clearPendingActions(): Promise<void> {
    await this.ensureDB();
    const pending = await this.getPendingActions();
    await Promise.all(pending.map((a) => this.deleteFromStore(STORE_STATE, a.id)));
    await this.refreshPendingCount();
  }

  /** Clear all cached economy data */
  async clearAll(): Promise<void> {
    await this.ensureDB();
    await Promise.all([
      this.clearStore(STORE_CATALOG),
      this.clearStore(STORE_PACKAGES),
      this.clearStore(STORE_STICKERS),
      this.clearStore(STORE_STATE),
    ]);
    this.isOfflineMode.set(false);
    this.pendingActionCount.set(0);
  }

  // --- Generic IDB helpers ---

  private putInStore(storeName: string, value: object): Promise<void> {
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
