import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import { I18nService } from './i18n.service';
import { showToast } from './toast.service';

export interface EscrowPayment {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowPaymentStatus;
  description: string;
  terms_locked: boolean;
  payer_approved: boolean;
  payee_approved: boolean;
  dispute_reason: string | null;
  dispute_resolved_by: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type EscrowPaymentStatus =
  | 'pending'
  | 'funded'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';

export interface CreateEscrowPaymentPayload {
  payee_id: string;
  amount_coins: number;
  description: string;
}

interface QueuedEscrowAction {
  id: string;
  type: 'create' | 'fund' | 'approve_delivery' | 'complete' | 'cancel' | 'dispute';
  payload: Record<string, unknown>;
  created_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class EscrowService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private networkStatus = inject(NetworkStatusService);
  private i18n = inject(I18nService);
  private baseUrl = `${environment.apiUrl}/escrow`;

  private readonly dbName = 'escrow_offline_db';
  private readonly storeName = 'actions';
  private db: IDBDatabase | null = null;
  private dbInitPromise: Promise<void> | null = null;

  readonly payments = signal<EscrowPayment[]>([]);
  readonly isLoading = signal(false);
  readonly offlineQueueCount = signal(0);

  constructor() {
    if (this.isIndexedDBAvailable()) {
      this.dbInitPromise = this.initDB();
      this.dbInitPromise.then(() => this.processQueue()).catch(() => undefined);

      window.addEventListener('online', () => {
        this.processQueue().catch(() => undefined);
      });
    }
  }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getAccessToken();
    return new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` });
  }

  private isIndexedDBAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.indexedDB;
  }

  // ---- IndexedDB queue persistence ----

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
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  private async ensureDB(): Promise<void> {
    if (this.dbInitPromise) await this.dbInitPromise;
    if (!this.db) throw new Error('IndexedDB not initialised');
  }

  private async enqueueAction(action: QueuedEscrowAction): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(action);
      request.onsuccess = () => {
        this.offlineQueueCount.update((c) => c + 1);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async getQueuedActions(): Promise<QueuedEscrowAction[]> {
    if (!this.isIndexedDBAvailable()) return [];
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  private async removeAction(id: string): Promise<void> {
    if (!this.isIndexedDBAvailable()) return;
    await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      request.onsuccess = () => {
        this.offlineQueueCount.update((c) => Math.max(0, c - 1));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async refreshQueueCount(): Promise<void> {
    try {
      const actions = await this.getQueuedActions();
      this.offlineQueueCount.set(actions.length);
    } catch {
      // Silently handle refresh failures
    }
  }

  // ---- Offline queue processor ----

  async processQueue(): Promise<void> {
    if (!this.networkStatus.isOnline()) return;

    const actions = await this.getQueuedActions();
    if (actions.length === 0) return;

    // Sort by creation time, oldest first
    actions.sort((a, b) => a.created_at.localeCompare(b.created_at));

    for (const action of actions) {
      try {
        await this.executeAction(action);
        await this.removeAction(action.id);
        showToast(this.i18n.translate('escrow.offlineActionSynced'));
      } catch (e) {
        // Stop processing on first failure to preserve ordering
        break;
      }
    }
  }

  private async executeAction(action: QueuedEscrowAction): Promise<void> {
    switch (action.type) {
      case 'create': {
        const payload = action.payload as { payee_id: string; amount_coins: number; description: string };
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/payments`, payload, { headers: this.getHeaders() }),
        );
        break;
      }
      case 'fund': {
        const paymentId = action.payload['paymentId'] as string;
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/payments/${paymentId}/fund`, {}, { headers: this.getHeaders() }),
        );
        break;
      }
      case 'complete': {
        const paymentId = action.payload['paymentId'] as string;
        await firstValueFrom(
          this.http.post(`${this.baseUrl}/payments/${paymentId}/complete`, {}, { headers: this.getHeaders() }),
        );
        break;
      }
      case 'approve_delivery':
      case 'cancel':
      case 'dispute': {
        const paymentId = action.payload['paymentId'] as string;
        const actionType = action.type === 'approve_delivery' ? 'approve_delivery' : action.type;
        const reason = (action.payload['reason'] as string) ?? undefined;
        await firstValueFrom(
          this.http.put(`${this.baseUrl}/payments/${paymentId}`, { action: actionType, reason }, { headers: this.getHeaders() }),
        );
        break;
      }
    }
  }

  // ---- API methods (with offline fallback) ----

  async loadPayments(): Promise<void> {
    if (!this.networkStatus.isOnline()) {
      // Return cached data when offline
      return;
    }

    this.isLoading.set(true);
    try {
      const data = await firstValueFrom(
        this.http.get<EscrowPayment[]>(`${this.baseUrl}/payments`, { headers: this.getHeaders() }),
      );
      this.payments.set(data ?? []);
      this.cachePaymentsOffline(data ?? []);
    } catch (e) {
      // Fallback to cached offline data on error
      const cached = await this.loadCachedPayments();
      this.payments.set(cached);
    } finally {
      this.isLoading.set(false);
    }
  }

  async getPayment(id: string): Promise<EscrowPayment | null> {
    if (!this.networkStatus.isOnline()) {
      return this.payments().find((p) => p.id === id) ?? null;
    }

    try {
      return await firstValueFrom(
        this.http.get<EscrowPayment>(`${this.baseUrl}/payments/${id}`, { headers: this.getHeaders() }),
      );
    } catch {
      return this.payments().find((p) => p.id === id) ?? null;
    }
  }

  async createPayment(payload: CreateEscrowPaymentPayload): Promise<EscrowPayment | null> {
    if (!this.networkStatus.isOnline()) {
      const offlineAction: QueuedEscrowAction = {
        id: crypto.randomUUID(),
        type: 'create',
        payload: payload as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      };
      await this.enqueueAction(offlineAction);
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return null;
    }

    try {
      const result = await firstValueFrom(
        this.http.post<EscrowPayment>(`${this.baseUrl}/payments`, payload, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return result;
    } catch {
      showToast(this.i18n.translate('escrow.createError'));
      return null;
    }
  }

  async fundPayment(paymentId: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.enqueueAction({
        id: crypto.randomUUID(),
        type: 'fund',
        payload: { paymentId },
        created_at: new Date().toISOString(),
      });
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return true;
    }

    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/payments/${paymentId}/fund`, {}, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return true;
    } catch {
      showToast(this.i18n.translate('escrow.fundError'));
      return false;
    }
  }

  async approveDelivery(paymentId: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.enqueueAction({
        id: crypto.randomUUID(),
        type: 'approve_delivery',
        payload: { paymentId },
        created_at: new Date().toISOString(),
      });
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return true;
    }

    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/payments/${paymentId}`, { action: 'approve_delivery' }, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return true;
    } catch {
      showToast(this.i18n.translate('escrow.approveError'));
      return false;
    }
  }

  async completePayment(paymentId: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.enqueueAction({
        id: crypto.randomUUID(),
        type: 'complete',
        payload: { paymentId },
        created_at: new Date().toISOString(),
      });
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return true;
    }

    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/payments/${paymentId}/complete`, {}, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return true;
    } catch {
      showToast(this.i18n.translate('escrow.completeError'));
      return false;
    }
  }

  async cancelPayment(paymentId: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.enqueueAction({
        id: crypto.randomUUID(),
        type: 'cancel',
        payload: { paymentId },
        created_at: new Date().toISOString(),
      });
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return true;
    }

    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/payments/${paymentId}`, { action: 'cancel' }, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return true;
    } catch {
      showToast(this.i18n.translate('escrow.cancelError'));
      return false;
    }
  }

  async raiseDispute(paymentId: string, reason: string): Promise<boolean> {
    if (!this.networkStatus.isOnline()) {
      await this.enqueueAction({
        id: crypto.randomUUID(),
        type: 'dispute',
        payload: { paymentId, reason },
        created_at: new Date().toISOString(),
      });
      showToast(this.i18n.translate('escrow.offlineQueued'));
      return true;
    }

    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/payments/${paymentId}`, { action: 'raise_dispute', reason }, { headers: this.getHeaders() }),
      );
      await this.loadPayments();
      return true;
    } catch {
      showToast(this.i18n.translate('escrow.disputeError'));
      return false;
    }
  }

  // ---- Cache API offline storage ----

  private async cachePaymentsOffline(payments: EscrowPayment[]): Promise<void> {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open('escrow-payments');
      const response = new Response(JSON.stringify(payments), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(`${this.baseUrl}/payments`, response);
    } catch {
      // Cache write failures are non-critical
    }
  }

  private async loadCachedPayments(): Promise<EscrowPayment[]> {
    if (!('caches' in window)) return [];
    try {
      const cache = await caches.open('escrow-payments');
      const cached = await cache.match(`${this.baseUrl}/payments`);
      if (cached) {
        return (await cached.json()) as EscrowPayment[];
      }
    } catch {
      // Cache read failures are non-critical
    }
    return [];
  }

  /** Forces processing of all queued offline actions immediately */
  async syncNow(): Promise<void> {
    if (this.networkStatus.isOnline()) {
      await this.processQueue();
    }
  }
}