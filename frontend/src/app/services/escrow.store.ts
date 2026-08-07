import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';
import { showToast } from './toast.service';

export interface EscrowTransaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  status: 'pending' | 'released' | 'disputed' | 'refunded' | 'cancelled';
  description: string;
  service_type?: string;
  dispute_reason?: string | null;
  dispute_evidence?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowCreatePayload {
  partner_id: string;
  amount: number;
  description: string;
  service_type?: string;
}

export interface EscrowSummary {
  total_outgoing: number;
  total_incoming: number;
  pending_outgoing: number;
  pending_incoming: number;
  disputed_count: number;
  total_transactions: number;
}

export type EscrowStatus = EscrowTransaction['status'];

function mapEscrow(item: unknown): EscrowTransaction {
  const e = item as Record<string, unknown>;
  return {
    id: String(e['id'] ?? ''),
    sender_id: String(e['sender_id'] ?? ''),
    receiver_id: String(e['receiver_id'] ?? ''),
    amount: Number(e['amount'] ?? 0),
    status: (e['status'] as EscrowStatus) ?? 'pending',
    description: String(e['description'] ?? ''),
    service_type: e['service_type'] ? String(e['service_type']) : undefined,
    dispute_reason: e['dispute_reason'] ? String(e['dispute_reason']) : null,
    dispute_evidence: e['dispute_evidence'] ? String(e['dispute_evidence']) : null,
    admin_note: e['admin_note'] ? String(e['admin_note']) : null,
    created_at: String(e['created_at'] ?? new Date().toISOString()),
    updated_at: String(e['updated_at'] ?? new Date().toISOString()),
  };
}

@Injectable({
  providedIn: 'root',
})
export class EscrowStore {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private i18n = inject(I18nService);
  private baseUrl = `${environment.apiUrl}/escrow`;

  readonly escrows = signal<EscrowTransaction[]>([]);
  readonly outgoingEscrows = signal<EscrowTransaction[]>([]);
  readonly incomingEscrows = signal<EscrowTransaction[]>([]);
  readonly selectedEscrow = signal<EscrowTransaction | null>(null);
  readonly summary = signal<EscrowSummary | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly pendingOutgoing = computed(() =>
    this.outgoingEscrows().filter(e => e.status === 'pending'),
  );

  readonly pendingIncoming = computed(() =>
    this.incomingEscrows().filter(e => e.status === 'pending'),
  );

  readonly disputedEscrows = computed(() =>
    this.escrows().filter(e => e.status === 'disputed'),
  );

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  async loadEscrows(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.get<EscrowTransaction[]>(`${this.baseUrl}`, {
          headers: this.getHeaders(),
        }),
      );
      this.escrows.set((Array.isArray(result) ? result : []).map(mapEscrow));
    } catch {
      this.error.set(this.i18n.translate('escrow.loadError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadOutgoing(status?: string): Promise<void> {
    this.isLoading.set(true);
    try {
      let url = `${this.baseUrl}/outgoing`;
      if (status) url += `?status=${status}`;
      const result = await firstValueFrom(
        this.http.get<EscrowTransaction[]>(url, {
          headers: this.getHeaders(),
        }),
      );
      this.outgoingEscrows.set((Array.isArray(result) ? result : []).map(mapEscrow));
    } catch {
      this.error.set(this.i18n.translate('escrow.loadError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadIncoming(status?: string): Promise<void> {
    this.isLoading.set(true);
    try {
      let url = `${this.baseUrl}/incoming`;
      if (status) url += `?status=${status}`;
      const result = await firstValueFrom(
        this.http.get<EscrowTransaction[]>(url, {
          headers: this.getHeaders(),
        }),
      );
      this.incomingEscrows.set((Array.isArray(result) ? result : []).map(mapEscrow));
    } catch {
      this.error.set(this.i18n.translate('escrow.loadError'));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadSummary(): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.http.get<EscrowSummary>(`${this.baseUrl}/summary`, {
          headers: this.getHeaders(),
        }),
      );
      this.summary.set(result);
    } catch {
      // Summary is supplemental; swallow errors
    }
  }

  async getEscrow(id: string): Promise<EscrowTransaction | null> {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.get<EscrowTransaction>(`${this.baseUrl}/${id}`, {
          headers: this.getHeaders(),
        }),
      );
      const mapped = mapEscrow(result);
      this.selectedEscrow.set(mapped);
      return mapped;
    } catch {
      this.error.set(this.i18n.translate('escrow.notFound'));
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }

  async createEscrow(payload: EscrowCreatePayload): Promise<EscrowTransaction | null> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<EscrowTransaction>(`${this.baseUrl}/create`, payload, {
          headers: this.getHeaders(),
        }),
      );
      const mapped = mapEscrow(result);
      this.escrows.update((arr) => [mapped, ...arr]);
      showToast(this.i18n.translate('escrow.createSuccess'));
      return mapped;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('escrow.createError');
      this.error.set(msg);
      showToast(msg);
      return null;
    }
  }

  async releaseEscrow(escrowId: string): Promise<boolean> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<EscrowTransaction>(`${this.baseUrl}/${escrowId}/release`, {}, {
          headers: this.getHeaders(),
        }),
      );
      this.updateEscrowInList(escrowId, mapEscrow(result));
      this.selectedEscrow.update((current) =>
        current?.id === escrowId ? mapEscrow(result) : current,
      );
      showToast(this.i18n.translate('escrow.releaseSuccess'));
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('escrow.releaseError');
      showToast(msg);
      return false;
    }
  }

  async refundEscrow(escrowId: string, reason?: string): Promise<boolean> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<EscrowTransaction>(`${this.baseUrl}/${escrowId}/refund`, { reason }, {
          headers: this.getHeaders(),
        }),
      );
      this.updateEscrowInList(escrowId, mapEscrow(result));
      this.selectedEscrow.update((current) =>
        current?.id === escrowId ? mapEscrow(result) : current,
      );
      showToast(this.i18n.translate('escrow.refundSuccess'));
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('escrow.refundError');
      showToast(msg);
      return false;
    }
  }

  async cancelEscrow(escrowId: string): Promise<boolean> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<EscrowTransaction>(`${this.baseUrl}/${escrowId}/cancel`, {}, {
          headers: this.getHeaders(),
        }),
      );
      this.updateEscrowInList(escrowId, mapEscrow(result));
      this.selectedEscrow.update((current) =>
        current?.id === escrowId ? mapEscrow(result) : current,
      );
      showToast(this.i18n.translate('escrow.cancelSuccess'));
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('escrow.cancelError');
      showToast(msg);
      return false;
    }
  }

  async disputeEscrow(escrowId: string, reason: string, details?: string): Promise<boolean> {
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<EscrowTransaction>(`${this.baseUrl}/${escrowId}/dispute`, {
          reason,
          evidence: details,
        }, {
          headers: this.getHeaders(),
        }),
      );
      this.updateEscrowInList(escrowId, mapEscrow(result));
      this.selectedEscrow.update((current) =>
        current?.id === escrowId ? mapEscrow(result) : current,
      );
      showToast(this.i18n.translate('escrow.disputeSuccess'));
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : this.i18n.translate('escrow.disputeError');
      showToast(msg);
      return false;
    }
  }

  private updateEscrowInList(id: string, updated: EscrowTransaction): void {
    this.escrows.update((arr) =>
      arr.map((e) => (e.id === id ? updated : e)),
    );
    this.outgoingEscrows.update((arr) =>
      arr.map((e) => (e.id === id ? updated : e)),
    );
    this.incomingEscrows.update((arr) =>
      arr.map((e) => (e.id === id ? updated : e)),
    );
  }
}