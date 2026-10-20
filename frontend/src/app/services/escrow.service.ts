import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import {
  EscrowOfflineService,
  EscrowRow,
  EscrowCreateResult,
  EscrowReleaseResult,
  EscrowRefundResult,
  EscrowOperation,
} from './escrow-offline.service';

// Re-export EscrowRow as EscrowTransaction for backward compatibility
export type EscrowTransaction = EscrowRow;

/** Wire contract returned by the backend escrow transaction endpoints. */
export interface EscrowTransactionResponse {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowRow['status'];
  reason: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Escrow Payments service.
 *
 * Orchestrates online API calls and offline fallback via EscrowOfflineService.
 * When the device is offline, escrow data is served from the local IndexedDB
 * cache and write operations are queued for later synchronisation.
 */
@Injectable({ providedIn: 'root' })
export class EscrowService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly network = inject(NetworkStatusService);
  private readonly offlineStore = inject(EscrowOfflineService);

  private readonly baseUrl = `${environment.apiUrl}/escrow`;

  /** Whether the escrow data is currently loading */
  readonly loading = signal(false);

  /** The currently fetched escrow list */
  readonly escrows = signal<EscrowRow[]>([]);

  /** Count of pending offline operations for UI badges */
  readonly pendingOperationCount = this.offlineStore.pendingOperationCount;

  /** Alias for listUserEscrows used by existing pages */
  async listEscrows(status?: string): Promise<EscrowRow[]> {
    return this.listUserEscrows(status);
  }

  /**
   * Creates a new escrow. If offline, queues the operation and returns a
   * placeholder result so the UI can proceed immediately.
   */
  async createEscrow(dto: {
    partner_id: string;
    amount: number;
    description: string;
    service_type?: string;
  }): Promise<EscrowCreateResult> {
    const holdDto = {
      payee_id: dto.partner_id,
      amount_coins: dto.amount,
      reason: dto.description,
      metadata: dto.service_type ? { service_type: dto.service_type } : undefined,
    };

    if (!this.network.isOnline()) {
      const key = `create_${Date.now()}_${crypto.randomUUID()}`;
      const op: EscrowOperation = {
        key,
        endpoint: `${this.baseUrl}/hold`,
        method: 'POST',
        payload: holdDto as unknown as Record<string, unknown>,
        queued_at: new Date().toISOString(),
        retry_count: 0,
      };
      await this.offlineStore.enqueueOperation(op);
      return {
        id: 'offline-' + crypto.randomUUID(),
        status: 'pending',
        amount_held: dto.amount,
        coins_remaining: -1,
      };
    }

    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const result = await firstValueFrom(
      this.http.post<EscrowCreateResult>(`${this.baseUrl}/hold`, holdDto, { headers }),
    );
    return result;
  }

  /**
   * Releases an escrow. Queues offline if needed.
   */
  async releaseEscrow(escrowId: string): Promise<EscrowReleaseResult> {
    if (!this.network.isOnline()) {
      const key = `release_${escrowId}_${Date.now()}`;
      const op: EscrowOperation = {
        key,
        endpoint: `${this.baseUrl}/release`,
        method: 'POST',
        payload: { transaction_id: escrowId },
        queued_at: new Date().toISOString(),
        retry_count: 0,
      };
      await this.offlineStore.enqueueOperation(op);
      return {
        id: escrowId,
        status: 'released',
        amount_released: 0,
        receiver_new_balance: -1,
      };
    }

    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return firstValueFrom(
      this.http.post<EscrowReleaseResult>(
        `${this.baseUrl}/release`,
        { transaction_id: escrowId },
        { headers },
      ),
    );
  }

  /**
   * Refunds an escrow. Queues offline if needed.
   */
  async refundEscrow(escrowId: string, reason?: string): Promise<EscrowRefundResult> {
    if (!this.network.isOnline()) {
      const key = `refund_${escrowId}_${Date.now()}`;
      const op: EscrowOperation = {
        key,
        endpoint: `${this.baseUrl}/refund`,
        method: 'POST',
        payload: { transaction_id: escrowId, reason },
        queued_at: new Date().toISOString(),
        retry_count: 0,
      };
      await this.offlineStore.enqueueOperation(op);
      return {
        id: escrowId,
        status: 'refunded',
        amount_refunded: 0,
        sender_new_balance: -1,
      };
    }

    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return firstValueFrom(
      this.http.post<EscrowRefundResult>(
        `${this.baseUrl}/refund`,
        { transaction_id: escrowId, reason },
        { headers },
      ),
    );
  }

  /**
   * Opens a dispute for an escrow. Queues offline if needed.
   */
  async disputeEscrow(escrowId: string, reason: string, evidence?: string): Promise<EscrowRow> {
    if (!this.network.isOnline()) {
      const key = `dispute_${escrowId}_${Date.now()}`;
      const op: EscrowOperation = {
        key,
        endpoint: `${this.baseUrl}/dispute`,
        method: 'POST',
        payload: { transaction_id: escrowId, reason, evidence },
        queued_at: new Date().toISOString(),
        retry_count: 0,
      };
      await this.offlineStore.enqueueOperation(op);
      return {
        id: escrowId,
        sender_id: '',
        receiver_id: '',
        amount: 0,
        status: 'disputed',
        description: '',
        service_type: 'other',
        dispute_reason: reason,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const result = await firstValueFrom(
      this.http.post<EscrowTransactionResponse>(
        `${this.baseUrl}/dispute`,
        { transaction_id: escrowId, reason, evidence },
        { headers },
      ),
    );
    return this.adaptTransaction(result);
  }

  /**
   * Adapts a backend EscrowTransactionResponse to the frontend EscrowRow format.
   */
  private adaptTransaction(data: EscrowTransactionResponse): EscrowRow {
    const metadata = data.metadata ?? {};
    const serviceType = metadata['service_type'];
    const disputeReason = metadata['dispute_reason'];
    const disputeEvidence = metadata['dispute_evidence'];
    const adminNote = metadata['admin_note'];
    return {
      id: data.id,
      sender_id: data.payer_id,
      receiver_id: data.payee_id,
      amount: data.amount_coins,
      status: data.status,
      description: data.reason,
      service_type:
        serviceType === 'lesson' ||
        serviceType === 'language_exchange' ||
        serviceType === 'proofreading' ||
        serviceType === 'translation'
          ? serviceType
          : 'other',
      dispute_reason: typeof disputeReason === 'string' ? disputeReason : null,
      dispute_evidence: typeof disputeEvidence === 'string' ? disputeEvidence : null,
      admin_note: typeof adminNote === 'string' ? adminNote : null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * Fetches a single escrow. Falls back to cached data when offline.
   */
  async getEscrow(escrowId: string): Promise<EscrowRow | undefined> {
    if (!this.network.isOnline()) {
      return this.offlineStore.getCachedEscrow(escrowId);
    }

    const token = this.auth.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const result = await firstValueFrom(
      this.http.get<EscrowTransactionResponse>(`${this.baseUrl}/transactions/${escrowId}`, {
        headers,
      }),
    );
    const adapted = this.adaptTransaction(result);
    await this.offlineStore.cacheEscrows([adapted]);
    return adapted;
  }

  /**
   * Lists user escrows. Falls back to cached data when offline.
   */
  async listUserEscrows(status?: string): Promise<EscrowRow[]> {
    this.loading.set(true);
    try {
      if (!this.network.isOnline()) {
        return this.offlineStore.getCachedEscrows(status);
      }

      const token = this.auth.getAccessToken();
      const httpHeaders: Record<string, string> = {};
      if (token) {
        httpHeaders['Authorization'] = `Bearer ${token}`;
      }
      const params = status ? { status } : undefined;
      const result = await firstValueFrom(
        this.http.get<EscrowTransactionResponse[]>(`${this.baseUrl}/transactions`, {
          headers: httpHeaders,
          params,
        }),
      );
      const adapted = result.map((t) => this.adaptTransaction(t));
      await this.offlineStore.cacheEscrows(adapted);
      this.escrows.set(adapted);
      return adapted;
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Attempts to synchronise all queued offline operations with the server.
   * Removes operations that succeed. Individual failures are isolated.
   */
  async syncOfflineOperations(): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    const token = this.auth.getAccessToken();
    if (!token) return { sent, failed };

    const operations = await this.offlineStore.getPendingOperations();
    for (const op of operations) {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        await firstValueFrom(
          this.http.request(op.method, op.endpoint, {
            body: op.payload,
            headers,
          }),
        );
        await this.offlineStore.removeOperation(op.key);
        sent++;
      } catch {
        failed++;
        // Increment retry count; abandon after 5 failures
        const updatedOp: EscrowOperation = {
          ...op,
          retry_count: op.retry_count + 1,
        };
        if (updatedOp.retry_count >= 5) {
          await this.offlineStore.removeOperation(op.key);
        } else {
          await this.offlineStore.enqueueOperation(updatedOp);
        }
      }
    }

    // Refresh escrow list after sync
    if (sent > 0) {
      await this.listUserEscrows();
    }

    return { sent, failed };
  }
}
