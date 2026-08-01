import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { showToast } from './toast.service';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  created_at: string;
}

export interface RestoreResult {
  success: boolean;
  restoredPlans: string[];
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class RestorePurchasesService {
  readonly isRestoring = signal<boolean>(false);
  readonly lastRestoreResult = signal<RestoreResult | null>(null);

  private supabaseService = inject(SupabaseService);

  async restorePurchases(): Promise<RestoreResult> {
    this.isRestoring.set(true);
    this.lastRestoreResult.set(null);

    try {
      const supabase = this.supabaseService.getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const result: RestoreResult = {
          success: false,
          restoredPlans: [],
          message: 'You must be logged in to restore purchases.',
        };
        this.lastRestoreResult.set(result);
        return result;
      }

      // Query the subscriptions table for any active or past subscriptions
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .returns<SubscriptionRow[]>()
        .filter('user_id', 'eq', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const restoredPlans: string[] = [];
      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          // Check if subscription is still valid (not expired)
          if (sub.status === 'active' || sub.status === 'trialing') {
            // Reactivate the subscription in the user's profile
            const { error: updateError } = await supabase
              .from('users')
              .update({
                is_vip: true,
                vip_tier: sub.plan_id,
              })
              .eq('id', user.id);

            if (!updateError) {
              restoredPlans.push(sub.plan_id);
            }
          }
        }
      }

      const result: RestoreResult = {
        success: restoredPlans.length > 0,
        restoredPlans,
        message:
          restoredPlans.length > 0
            ? `Successfully restored ${restoredPlans.length} purchase(s).`
            : 'No previous purchases found to restore.',
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
