import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { showToast } from './toast.service';
import { environment } from '../../environments/environment';

export interface RestoreResult {
  success: boolean;
  restoredPlans: string[];
  message: string;
}

export interface RestorePurchasesApiResponse {
  received: boolean;
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class RestorePurchasesService {
  readonly isRestoring = signal<boolean>(false);
  readonly lastRestoreResult = signal<RestoreResult | null>(null);

  private http = inject(HttpClient);

  async restorePurchases(platform: 'ios' | 'android' | 'stripe' = 'stripe', receiptData?: string): Promise<RestoreResult> {
    this.isRestoring.set(true);
    this.lastRestoreResult.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<RestorePurchasesApiResponse>(
          `${environment.apiUrl}/monetisation/restore-purchases`,
          { platform, receipt_data: receiptData },
        ),
      );

      const success = response.status === 'restored';
      const result: RestoreResult = {
        success,
        restoredPlans: success ? [response.status] : [],
        message: success
          ? 'Successfully restored your purchase(s).'
          : response.status === 'no_valid_subscription'
            ? 'No previous purchases found to restore.'
            : 'Failed to restore purchases. Please try again later.',
      };

      this.lastRestoreResult.set(result);

      if (result.success) {
        showToast(result.message, 'success', 4000);
      } else {
        showToast(result.message, 'info', 4000);
      }

      return result;
    } catch {
      const result: RestoreResult = {
        success: false,
        restoredPlans: [],
        message: 'Failed to restore purchases. Please try again later.',
      };
      this.lastRestoreResult.set(result);
      showToast(result.message, 'error', 5000);
      return result;
    } finally {
      this.isRestoring.set(false);
    }
  }
}
