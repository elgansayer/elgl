import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GdprArchiveResponse {
  request_id: string;
  status: 'processing' | 'ready';
  download_url?: string;
  expires_at?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class GdprService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiUrl;

  async requestArchive(
    receiptId?: string,
    appStore?: string,
  ): Promise<GdprArchiveResponse> {
    return lastValueFrom(
      this.http.post<GdprArchiveResponse>(`${this.apiBase}/privacy/request-archive`, {
        receipt_id: receiptId,
        app_store: appStore,
      }),
    );
  }

  async deleteAccount(confirmDelete: boolean): Promise<void> {
    await lastValueFrom(
      this.http.post(`${this.apiBase}/privacy/delete-account`, {
        confirm_delete: confirmDelete,
      }),
    );
  }

  async cancelDeletion(): Promise<void> {
    await lastValueFrom(this.http.post(`${this.apiBase}/privacy/cancel-deletion`, {}));
  }
}
