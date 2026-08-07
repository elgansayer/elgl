import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EscrowTransaction {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  status: 'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';
  description: string;
  service_type: string;
  dispute_reason?: string | null;
  dispute_evidence?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowCreateResult {
  id: string;
  status: string;
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

export interface EscrowSummary {
  total_sent: number;
  total_received: number;
  pending_sent: number;
  pending_received: number;
  disputed_count: number;
  total_transactions: number;
}

const EMPTY_ESCROWS: EscrowTransaction[] = [];

@Injectable({ providedIn: 'root' })
export class EscrowService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/escrow`;

  async listEscrows(status?: string): Promise<EscrowTransaction[]> {
    const params: Record<string, string> = {};
    if (status) {
      params['status'] = status;
    }
    return firstValueFrom(
      this.http.get<EscrowTransaction[]>(this.baseUrl, { params }),
    ).catch(() => EMPTY_ESCROWS);
  }

  async getEscrow(id: string): Promise<EscrowTransaction> {
    return firstValueFrom(
      this.http.get<EscrowTransaction>(`${this.baseUrl}/${id}`),
    );
  }

  async createEscrow(
    partnerId: string,
    amount: number,
    description: string,
    serviceType?: string,
  ): Promise<EscrowCreateResult> {
    return firstValueFrom(
      this.http.post<EscrowCreateResult>(`${this.baseUrl}/create`, {
        partner_id: partnerId,
        amount,
        description,
        service_type: serviceType ?? 'other',
      }),
    );
  }

  async releaseEscrow(escrowId: string): Promise<EscrowReleaseResult> {
    return firstValueFrom(
      this.http.post<EscrowReleaseResult>(`${this.baseUrl}/release`, {
        escrow_id: escrowId,
      }),
    );
  }

  async refundEscrow(escrowId: string, reason?: string): Promise<EscrowRefundResult> {
    return firstValueFrom(
      this.http.post<EscrowRefundResult>(`${this.baseUrl}/refund`, {
        escrow_id: escrowId,
        reason: reason ?? undefined,
      }),
    );
  }

  async disputeEscrow(escrowId: string, reason: string, evidence?: string): Promise<EscrowTransaction> {
    return firstValueFrom(
      this.http.post<EscrowTransaction>(`${this.baseUrl}/dispute`, {
        escrow_id: escrowId,
        reason,
        evidence: evidence ?? undefined,
      }),
    );
  }

  async getSummary(): Promise<EscrowSummary> {
    return firstValueFrom(
      this.http.get<EscrowSummary>(`${this.baseUrl}/summary`),
    ).catch(() => ({
      total_sent: 0,
      total_received: 0,
      pending_sent: 0,
      pending_received: 0,
      disputed_count: 0,
      total_transactions: 0,
    }));
  }
}