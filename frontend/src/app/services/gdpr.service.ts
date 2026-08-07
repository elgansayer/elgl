import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GdprService {
  private http = inject(HttpClient);

  async requestArchive(receiptId?: string, appStore?: string): Promise<void> {
    await lastValueFrom(
      this.http.post('/api/privacy/request-archive', { receipt_id: receiptId, app_store: appStore }),
    );
  }

  async deleteAccount(confirmDelete: boolean): Promise<void> {
    await lastValueFrom(
      this.http.post('/api/privacy/delete-account', { confirm_delete: confirmDelete }),
    );
  }

  async cancelDeletion(): Promise<void> {
    await lastValueFrom(
      this.http.post('/api/privacy/cancel-deletion', {}),
    );
  }
}
