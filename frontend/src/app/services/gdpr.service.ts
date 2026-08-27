import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

export interface GdprArchiveResponse {
  request_id: string;
  status: 'processing' | 'ready';
  download_url?: string;
  expires_at?: string;
  message: string;
}

export interface AccountDeletionStatus {
  pending: boolean;
  scheduled_for: string | null;
  requested_at: string | null;
}

export interface GdprStatusResponse {
  deletion: AccountDeletionStatus;
}

@Injectable({ providedIn: 'root' })
export class GdprService {
  private http = inject(HttpClient);

  async getStatus(): Promise<GdprStatusResponse> {
    const response = await lastValueFrom(
      this.http.get<unknown>('/api/privacy/status'),
    );
    return this.parseStatusResponse(response);
  }

  async requestArchive(
    receiptId?: string,
    appStore?: string,
  ): Promise<GdprArchiveResponse> {
    return lastValueFrom(
      this.http.post<GdprArchiveResponse>('/api/privacy/request-archive', {
        receipt_id: receiptId,
        app_store: appStore,
      }),
    );
  }

  async deleteAccount(confirmDelete: boolean): Promise<void> {
    await lastValueFrom(
      this.http.post('/api/privacy/delete-account', {
        confirm_delete: confirmDelete,
      }),
    );
  }

  async cancelDeletion(): Promise<void> {
    await lastValueFrom(this.http.post('/api/privacy/cancel-deletion', {}));
  }

  private parseStatusResponse(value: unknown): GdprStatusResponse {
    if (!this.isRecord(value) || !this.isRecord(value['deletion'])) {
      throw new Error('Invalid privacy status response');
    }

    const deletion = value['deletion'];
    if (typeof deletion['pending'] !== 'boolean') {
      throw new Error('Invalid privacy status response');
    }

    return {
      deletion: {
        pending: deletion['pending'],
        scheduled_for: this.parseNullableTimestamp(deletion['scheduled_for']),
        requested_at: this.parseNullableTimestamp(deletion['requested_at']),
      },
    };
  }

  private parseNullableTimestamp(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
      throw new Error('Invalid privacy status timestamp');
    }
    return new Date(value).toISOString();
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
