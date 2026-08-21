import { Injectable, signal, inject } from '@angular/core';
import { NetworkStatusService } from './network-status.service';

export type EscrowStatus =
  'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';

export type EscrowServiceType =
  'lesson' | 'language_exchange' | 'proofreading' | 'translation' | 'other';

export interface EscrowRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  status: EscrowStatus;
  description: string;
  service_type: EscrowServiceType;
  dispute_reason?: string | null;
  dispute_evidence?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowCreateResult {
  id: string;
  status: EscrowStatus;
  amount_held: number;
  coins_remaining: number;
}

export interface EscrowReleaseResult {
  id: string;
  status: 'released';
  amount_released: number;
  receiver_new_balance: number;
}

export interface EscrowRefundResult {
  id: string;
  status: 'refunded';
  amount_refunded: number;
  sender_new_balance: number;
}

export interface EscrowOperation {
  key: string;
  endpoint: string;
  method: 'POST' | 'GET';
  payload?: Record<string, unknown>;
  queued_at: string;
  retry_count: number;
}

const DB_NAME = 'hellotalk_escrow_offline';
const ESCROW_STORE = 'escrows';
const OPERATION_STORE = 'operations';
const DB_VERSION = 1;

/**
 * Offline storage service for Escrow Payments.
 *
 * Provides IndexedDB-backed persistence so that escrow data can be displayed
 * when the device is offline, and pending write operations (create / release /
 * refund / dispute) are queued for automatic retry when connectivity returns.
 */
@Injectable({ providedIn: 'root' })
export class EscrowOfflineService {
  private readonly network = inject(NetworkStatusService);
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /** Reactive count of pending offline operations */
  readonly pendingOperationCount = signal(0);

  constructor() {
    if (typeof window !== 'undefined' && window.indexedDB) {
      this.initPromise = this.initDB();
      this.initPromise
        .then(() => this.refreshPendingCount())
        .catch(() => undefined);
    }
  }

  // ── IndexedDB initialisation ──────────────────────────────

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
        if (!db.objectStoreNames.contains(ESCROW_STORE)) {
          db.createObjectStore(ESCROW_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(OPERATION_STORE)) {
          db.createObjectStore(OPERATION_STORE, {
            keyPath: 'key',
          });
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

  // ── Escrow CRUD helpers ───────────────────────────────────

  async cacheEscrows(escrows: EscrowRow[]): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    const tx = this.db!.transaction(ESCROW_STORE, 'readwrite');
    const store = tx.objectStore(ESCROW_STORE);
    for (const escrow of escrows) {
      store.put(escrow);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getCachedEscrow(id: string): Promise<EscrowRow | undefined> {
    if (!this.isAvailable()) return undefined;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(ESCROW_STORE, 'readonly');
      const store = tx.objectStore(ESCROW_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async getCachedEscrows(
    status?: string,
  ): Promise<EscrowRow[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(ESCROW_STORE, 'readonly');
      const store = tx.objectStore(ESCROW_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result ?? []) as EscrowRow[];
        if (status) {
          resolve(all.filter((e) => e.status === status));
        } else {
          resolve(all);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearEscrowCache(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(ESCROW_STORE, 'readwrite');
      const store = tx.objectStore(ESCROW_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── Operation queue for offline writes ────────────────────

  async enqueueOperation(op: EscrowOperation): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OPERATION_STORE, 'readwrite');
      const store = tx.objectStore(OPERATION_STORE);
      const req = store.put(op);
      req.onsuccess = () => {
        this.pendingOperationCount.update((c) => c + 1);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingOperations(): Promise<EscrowOperation[]> {
    if (!this.isAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OPERATION_STORE, 'readonly');
      const store = tx.objectStore(OPERATION_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result ?? []) as EscrowOperation[]);
      req.onerror = () => reject(req.error);
    });
  }

  async removeOperation(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OPERATION_STORE, 'readwrite');
      const store = tx.objectStore(OPERATION_STORE);
      const req = store.delete(key);
      req.onsuccess = () => {
        this.pendingOperationCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async clearOperationQueue(): Promise<void> {
    if (!this.isAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(OPERATION_STORE, 'readwrite');
      const store = tx.objectStore(OPERATION_STORE);
      const req = store.clear();
      req.onsuccess = () => {
        this.pendingOperationCount.set(0);
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  private async refreshPendingCount(): Promise<void> {
    try {
      const ops = await this.getPendingOperations();
      this.pendingOperationCount.set(ops.length);
    } catch {
      // Silently handle count refresh failures
    }
  }
}