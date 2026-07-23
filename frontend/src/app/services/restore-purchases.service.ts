import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ToastService } from '../components/primitives/toast/toast.service';

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

  constructor(
    private supabaseService: SupabaseService,
    private toastService: ToastService
  ) {}

  async restorePurchases(): Promise<RestoreResult> {
    this.isRestoring.set(true);
    this.lastRestoreResult.set(null);

    try {
      const supabase = this.supabaseService.getClient();
      const { data: { user } } = await supabase.auth.getUser();

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
        .eq('user_id', user.id)
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
        this.toastService.show({
          message: result.message,
          type: 'success',
          duration: 4000,
        });
      } else {
        this.toastService.show({
          message: result.message,
          type: 'info',
          duration: 4000,
        });
      }

      return result;
    } catch (error) {
      const result: RestoreResult = {
        success: false,
        restoredPlans: [],
        message: 'Failed to restore purchases. Please try again later.',
      };
      this.lastRestoreResult.set(result);

      this.toastService.show({
        message: result.message,
        type: 'error',
        duration: 5000,
      });

      return result;
    } finally {
      this.isRestoring.set(false);
    }
  }
}
