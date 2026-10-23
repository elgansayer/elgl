import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { showToast } from './toast.service';
import { I18nService } from './i18n.service';
import { environment } from '../../environments/environment';

export type RestorePlatform = 'ios' | 'android' | 'stripe';
export type RestoreStatus = 'restored' | 'no_valid_subscription' | 'failed';

export interface RestoreResult {
  success: boolean;
  restoredPlans: string[];
  message: string;
  status: RestoreStatus;
  platform: RestorePlatform;
  tier?: string;
}

export interface RestorePurchasesApiResponse {
  received: boolean;
  status: string;
  tier?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class RestorePurchasesService {
  readonly isRestoring = signal<boolean>(false);
  readonly lastRestoreResult = signal<RestoreResult | null>(null);

  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private inFlightRestore: Promise<RestoreResult> | null = null;

  restorePurchases(
    platform: RestorePlatform = 'stripe',
    receiptData?: string,
  ): Promise<RestoreResult> {
    if (this.inFlightRestore) {
      return this.inFlightRestore;
    }

    const task = this.performRestore(platform, receiptData);
    this.inFlightRestore = task;
    return task.finally(() => {
      if (this.inFlightRestore === task) {
        this.inFlightRestore = null;
      }
    });
  }

  private async performRestore(
    platform: RestorePlatform,
    receiptData?: string,
  ): Promise<RestoreResult> {
    this.isRestoring.set(true);

    try {
      const body: { platform: RestorePlatform; receipt_data?: string } = { platform };
      if (receiptData?.trim()) {
        body.receipt_data = receiptData.trim();
      }

      const response = await firstValueFrom(
        this.http.post<RestorePurchasesApiResponse>(
          `${environment.apiUrl}/monetisation/restore-purchases`,
          body,
        ),
      );

      if (!response || response.received !== true) {
        return this.publishFailure(platform);
      }

      if (response.status === 'restored') {
        const result: RestoreResult = {
          success: true,
          restoredPlans: response.tier ? [response.tier] : [],
          message: this.i18n.translate('restorePurchases.success'),
          status: 'restored',
          platform,
          ...(response.tier ? { tier: response.tier } : {}),
        };
        this.lastRestoreResult.set(result);
        showToast(result.message, 'success', 4000);
        return result;
      }

      if (response.status === 'no_valid_subscription') {
        const result: RestoreResult = {
          success: false,
          restoredPlans: [],
          message: this.i18n.translate('restorePurchases.noSubscriptionFound'),
          status: 'no_valid_subscription',
          platform,
        };
        this.lastRestoreResult.set(result);
        showToast(result.message, 'info', 4000);
        return result;
      }

      return this.publishFailure(platform);
    } catch {
      return this.publishFailure(platform);
    } finally {
      this.isRestoring.set(false);
    }
  }

  private publishFailure(platform: RestorePlatform): RestoreResult {
    const result: RestoreResult = {
      success: false,
      restoredPlans: [],
      message: this.i18n.translate('restorePurchases.failed'),
      status: 'failed',
      platform,
    };
    this.lastRestoreResult.set(result);
    showToast(result.message, 'error', 5000);
    return result;
  }
}
