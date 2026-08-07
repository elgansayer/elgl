import { Injectable, signal, inject } from '@angular/core';
import { MonetisationService } from './monetisation.service';
import { showToast } from './toast.service';

export interface RestoreResult {
  success: boolean;
  restoredPlans: string[];
  message: string;
}

/**
 * Detects the platform (iOS, Android, or web) from user-agent.
 * Returns 'ios', 'android', or 'stripe' for the web platform.
 */
function detectPlatform(): 'ios' | 'android' | 'stripe' {
  if (typeof navigator === 'undefined') return 'stripe';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'stripe';
}

@Injectable({
  providedIn: 'root',
})
export class RestorePurchasesService {
  readonly isRestoring = signal<boolean>(false);
  readonly lastRestoreResult = signal<RestoreResult | null>(null);

  private monetisationService = inject(MonetisationService);

  async restorePurchases(receiptData?: string): Promise<RestoreResult> {
    this.isRestoring.set(true);
    this.lastRestoreResult.set(null);

    try {
      const platform = detectPlatform();
      const response = await this.monetisationService.restorePurchases(platform, receiptData);

      if (response.status === 'restored') {
        const result: RestoreResult = {
          success: true,
          restoredPlans: [],
          message: 'Your purchases have been restored successfully.',
        };
        this.lastRestoreResult.set(result);
        showToast(result.message, 'success', 4000);
        return result;
      } else if (response.status === 'no_valid_subscription') {
        const result: RestoreResult = {
          success: false,
          restoredPlans: [],
          message: 'No previous purchases found to restore.',
        };
        this.lastRestoreResult.set(result);
        showToast(result.message, 'info', 4000);
        return result;
      } else {
        const result: RestoreResult = {
          success: false,
          restoredPlans: [],
          message: 'Failed to restore purchases. Please try again later.',
        };
        this.lastRestoreResult.set(result);
        showToast(result.message, 'info', 4000);
        return result;
      }
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
