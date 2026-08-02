import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '../supabase/supabase.service';
import { EconomyService } from './economy.service';

/**
 * Handles Google Play Developer Notifications (RTDN).
 * Processes subscription state changes, refunds, and other real-time notifications.
 */
@Injectable()
export class GooglePlayNotificationService {
  private readonly logger = new Logger(GooglePlayNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
    private readonly economyService: EconomyService,
  ) {}

  /**
   * Main entry point for processing a Google Play notification.
   * The notification is received as a Pub/Sub message containing a signed JWT.
   */
  handleNotification(message: Record<string, unknown>): void {
    try {
      // 1. Decode the Pub/Sub message
      const messageData = message?.message as
        Record<string, unknown> | undefined;
      const data = messageData?.data as string | undefined;
      if (!data) {
        this.logger.warn('Google Play notification missing data');
        return;
      }

      // 2. Decode base64-encoded data
      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      const notification = JSON.parse(decodedData) as Record<string, unknown>;

      // 3. Extract subscription notification details
      const subscriptionNotification = notification.subscriptionNotification as
        Record<string, unknown> | undefined;
      if (!subscriptionNotification) {
        this.logger.warn(
          'Google Play notification missing subscriptionNotification',
        );
        return;
      }

      const notificationType =
        subscriptionNotification.notificationType as number;
      const purchaseToken = subscriptionNotification.purchaseToken as string;
      const subscriptionId = subscriptionNotification.subscriptionId as string;

      this.logger.log(
        `Google Play notification: type=${notificationType}, subscriptionId=${subscriptionId}`,
      );

      // 4. Route to appropriate handler based on notification type
      switch (notificationType) {
        case 1: // SUBSCRIPTION_RECOVERED
          void this.handleSubscriptionRecovered(purchaseToken, subscriptionId);
          break;
        case 2: // SUBSCRIPTION_RENEWED
          void this.handleSubscriptionRenewed(purchaseToken, subscriptionId);
          break;
        case 3: // SUBSCRIPTION_CANCELED
          void this.handleSubscriptionCanceled(purchaseToken, subscriptionId);
          break;
        case 4: // SUBSCRIPTION_PURCHASED
          void this.handleSubscriptionPurchased(purchaseToken, subscriptionId);
          break;
        case 5: // SUBSCRIPTION_ON_HOLD
          void this.handleSubscriptionOnHold(purchaseToken, subscriptionId);
          break;
        case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
          void this.handleSubscriptionInGracePeriod(
            purchaseToken,
            subscriptionId,
          );
          break;
        case 7: // SUBSCRIPTION_RESTARTED
          void this.handleSubscriptionRestarted(purchaseToken, subscriptionId);
          break;
        case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
          void this.handleSubscriptionPriceChangeConfirmed(
            purchaseToken,
            subscriptionId,
          );
          break;
        case 9: // SUBSCRIPTION_DEFERRED
          void this.handleSubscriptionDeferred(purchaseToken, subscriptionId);
          break;
        case 12: // SUBSCRIPTION_REVOKED
          void this.handleSubscriptionRevoked(purchaseToken, subscriptionId);
          break;
        case 13: // SUBSCRIPTION_EXPIRED
          void this.handleSubscriptionExpired(purchaseToken, subscriptionId);
          break;
        default:
          this.logger.warn(
            `Unhandled Google Play notification type: ${notificationType}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process Google Play notification: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Handles a recovered subscription (user re-subscribed after cancellation).
   */
  private async handleSubscriptionRecovered(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      this.logger.warn(`No user found for purchase token ${purchaseToken}`);
      return;
    }

    this.logger.log(`User ${userId} subscription recovered: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'active');
  }

  /**
   * Handles a renewed subscription.
   */
  private async handleSubscriptionRenewed(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription renewed: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'active');
  }

  /**
   * Handles a canceled subscription.
   */
  private async handleSubscriptionCanceled(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription canceled: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'canceled');
  }

  /**
   * Handles a new subscription purchase.
   */
  private async handleSubscriptionPurchased(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} purchased subscription: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'active');
  }

  /**
   * Handles a subscription on hold.
   */
  private async handleSubscriptionOnHold(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription on hold: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'on_hold');
  }

  /**
   * Handles a subscription in grace period.
   */
  private async handleSubscriptionInGracePeriod(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} subscription in grace period: ${subscriptionId}`,
    );

    this.updateSubscriptionStatus(userId, subscriptionId, 'grace_period');
  }

  /**
   * Handles a restarted subscription.
   */
  private async handleSubscriptionRestarted(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription restarted: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'active');
  }

  /**
   * Handles a price change confirmation.
   */
  private async handleSubscriptionPriceChangeConfirmed(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} confirmed price change for subscription: ${subscriptionId}`,
    );

    // Update the price in the database if needed
    this.updateSubscriptionPrice(userId, subscriptionId);
  }

  /**
   * Handles a deferred subscription.
   */
  private async handleSubscriptionDeferred(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription deferred: ${subscriptionId}`);

    // Update the deferred date in the database    this.updateSubscriptionDeferredDate(userId, subscriptionId);
  }

  /**
   * Handles a revoked subscription.
   */
  private async handleSubscriptionRevoked(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription revoked: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'revoked');
    this.revokeSubscriptionBenefits(userId);
  }

  /**
   * Handles an expired subscription.
   */
  private async handleSubscriptionExpired(
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} subscription expired: ${subscriptionId}`);

    this.updateSubscriptionStatus(userId, subscriptionId, 'expired');
    this.revokeSubscriptionBenefits(userId);
  }

  /**
   * Retrieves the user ID associated with a purchase token.
   */
  private async getUserIdByPurchaseToken(
    purchaseToken: string,
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('purchase_token', purchaseToken)
      .single();

    const row = data as { user_id?: string } | null;
    return row?.user_id ?? null;
  }

  /**
   * Updates the subscription status in the database.
   */
  private updateSubscriptionStatus(
    userId: string,
    subscriptionId: string,
    status: string,
  ): void {
    const supabase = this.supabaseService.getClient();

    supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          product_id: subscriptionId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .then(({ error }) => {
        if (error) {
          this.logger.error(
            `Failed to update subscription for user ${userId}: ${error.message}`,
          );
        }
      });
  }

  /**
   * Updates the subscription price in the database.
   */
  private updateSubscriptionPrice(
    userId: string,
    subscriptionId: string,
  ): void {
    // Placeholder: In production, fetch the new price from Google Play API
    this.logger.log(
      `Would update price for user ${userId}, subscription ${subscriptionId}`,
    );
  }

  /**
   * Updates the deferred date for a subscription.
   */
  private updateSubscriptionDeferredDate(
    userId: string,
    subscriptionId: string,
  ): void {
    // Placeholder: In production, update the deferred date in the database
    this.logger.log(
      `Would update deferred date for user ${userId}, subscription ${subscriptionId}`,
    );
  }

  /**
   * Revokes subscription benefits for a user.
   */
  private revokeSubscriptionBenefits(userId: string): void {
    const supabase = this.supabaseService.getClient();

    supabase
      .from('users')
      .update({
        is_vip: false,
        vip_tier: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) {
          this.logger.error(
            `Failed to revoke subscription benefits for user ${userId}: ${error.message}`,
          );
        }
      });
  }
}
