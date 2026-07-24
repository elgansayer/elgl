import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { SupabaseService } from '../supabase/supabase.service';
import { EconomyService } from './economy.service';

/**
 * Handles Apple App Store Server-to-Server notifications (JWS signed payloads).
 * Processes subscription status changes, renewal notifications, and refunds.
 */
@Injectable()
export class AppleNotificationService {
  private readonly logger = new Logger(AppleNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
    private readonly economyService: EconomyService,
  ) {}

  /**
   * Main entry point for processing a signed JWS payload from Apple.
   * Verifies the JWS signature, decodes the notification payload,
   * and handles the appropriate notification type.
   */
  async handleNotification(signedPayload: string): Promise<void> {
    // 1. Verify JWS signature using Apple's public keys
    const decodedPayload = await this.verifyAndDecodeJWS(signedPayload);
    if (!decodedPayload) {
      this.logger.warn('Failed to verify Apple JWS payload');
      return;
    }

    const payload = decodedPayload as Record<string, unknown>;
    const notificationType = payload.notificationType as string;
    const subtype = payload.subtype as string | undefined;
    const data = payload.data as Record<string, unknown> | undefined;

    this.logger.log(
      `Apple notification: type=${notificationType}, subtype=${subtype}`,
    );

    // 2. Route to appropriate handler based on notification type
    switch (notificationType) {
      case 'SUBSCRIBED':
        await this.handleSubscribed(data);
        break;
      case 'DID_CHANGE_RENEWAL_STATUS':
        await this.handleRenewalStatusChange(data);
        break;
      case 'DID_CHANGE_RENEWAL_PREF':
        await this.handleRenewalPreferenceChange(data);
        break;
      case 'DID_FAIL_TO_RENEW':
        await this.handleFailedRenewal(data);
        break;
      case 'EXPIRED':
        await this.handleExpired(data);
        break;
      case 'REFUND':
        await this.handleRefund(data);
        break;
      case 'REVOKE':
        await this.handleRevoke(data);
        break;
      case 'PRICE_INCREASE':
        await this.handlePriceIncrease(data);
        break;
      case 'REFUND_DECLINED':
        await this.handleRefundDeclined(data);
        break;
      case 'CONSUMPTION_REQUEST':
        await this.handleConsumptionRequest(data);
        break;
      case 'RENEWAL_EXTENSION':
        await this.handleRenewalExtension(data);
        break;
      default:
        this.logger.warn(
          `Unhandled Apple notification type: ${notificationType}`,
        );
    }
  }

  /**
   * Verifies the JWS signature using Apple's public keys and decodes the payload.
   * In production, this should use a library like `jsonwebtoken` with Apple's root CA.
   * For now, we perform a basic decode without full verification (placeholder).
   */
  private verifyAndDecodeJWS(signedPayload: string): unknown | null {
    try {
      // JWS format: header.payload.signature
      const parts = signedPayload.split('.');
      if (parts.length !== 3) {
        this.logger.warn('Invalid JWS format');
        return null;
      }

      // Decode the payload (base64url)
      const payloadBase64 = parts[1];
      const payloadJson = Buffer.from(payloadBase64, 'base64url').toString(
        'utf-8',
      );
      const payload = JSON.parse(payloadJson);

      // In production, verify the JWS signature using Apple's public keys
      // For now, we trust the payload (placeholder)
      return payload;
    } catch (error) {
      this.logger.error(
        `Failed to decode Apple JWS payload: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Handles a new subscription event.
   */
  private async handleSubscribed(data: Record<string, unknown>): Promise<void> {
    const signedTransactionInfo = data?.signedTransactionInfo as Record<string, unknown> | undefined;
    const userId = data?.appAccountToken as string | undefined;
    const productId = signedTransactionInfo?.productId as string | undefined;
    const transactionId = signedTransactionInfo?.transactionId as string | undefined;

    if (!userId || !productId || !transactionId) {
      this.logger.warn('Missing required fields in SUBSCRIBED notification');
      return;
    }

    this.logger.log(
      `User ${userId} subscribed to product ${productId} (transaction: ${transactionId})`,
    );

    // Update user's subscription status in the database
    await this.updateSubscriptionStatus(
      userId,
      productId,
      'active',
      transactionId,
    );
  }

  /**
   * Handles a change in auto-renewal status (e.g., user turned off auto-renew).
   */
  private async handleRenewalStatusChange(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const autoRenewStatus = data?.autoRenewStatus as number | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} auto-renew status changed to ${autoRenewStatus}`,
    );

    // Update subscription auto-renew status
    await this.updateAutoRenewStatus(userId, autoRenewStatus === 1);
  }

  /**
   * Handles a change in renewal preference (e.g., user switched to a different product).
   */
  private async handleRenewalPreferenceChange(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const newProductId = data?.autoRenewProductId as string | undefined;

    if (!userId || !newProductId) {
      return;
    }

    this.logger.log(
      `User ${userId} changed renewal preference to product ${newProductId}`,
    );

    // Update the product the user will renew to
    await this.updateRenewalProduct(userId, newProductId);
  }

  /**
   * Handles a failed renewal attempt.
   */
  private async handleFailedRenewal(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const gracePeriodExpiresDate = data?.gracePeriodExpiresDate as string | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} failed to renew. Grace period expires: ${gracePeriodExpiresDate}`,
    );

    // Optionally notify the user about the failed renewal
    await this.notifyUserAboutFailedRenewal(userId, gracePeriodExpiresDate);
  }

  /**
   * Handles subscription expiration.
   */
  private async handleExpired(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const expirationIntent = data?.expirationIntent as number | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} subscription expired (intent: ${expirationIntent})`,
    );

    // Update subscription status to expired
    await this.updateSubscriptionStatus(userId, null, 'expired', null);
  }

  /**
   * Handles a refund request.
   */
  private async handleRefund(data: Record<string, unknown>): Promise<void> {
    const signedTransactionInfo = data?.signedTransactionInfo as Record<string, unknown> | undefined;
    const userId = data?.appAccountToken as string | undefined;
    const transactionId = signedTransactionInfo?.transactionId as string | undefined;

    if (!userId || !transactionId) {
      return;
    }

    this.logger.log(
      `User ${userId} received refund for transaction ${transactionId}`,
    );

    // Revoke coins or subscription benefits
    await this.revokeCoinsForRefund(userId, transactionId);
  }

  /**
   * Handles a revoke notification (e.g., family sharing removal).
   */
  private async handleRevoke(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} had their purchase revoked`);

    // Revoke subscription benefits
    await this.revokeSubscriptionBenefits(userId);
  }

  /**
   * Handles a price increase notification.
   */
  private async handlePriceIncrease(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const newPrice = data?.price as number | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} notified of price increase to ${newPrice}`);

    // Optionally notify the user about the price increase
    await this.notifyUserAboutPriceIncrease(userId, newPrice);
  }

  /**
   * Handles a refund declined notification.
   */
  private handleRefundDeclined(data: Record<string, unknown>): void {
    const userId = data?.appAccountToken as string | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(`User ${userId} refund request was declined`);
  }

  /**
   * Handles a consumption request (Apple asks for consumption data).
   */
  private async handleConsumptionRequest(data: Record<string, unknown>): Promise<void> {
    const signedTransactionInfo = data?.signedTransactionInfo as Record<string, unknown> | undefined;
    const userId = data?.appAccountToken as string | undefined;
    const transactionId = signedTransactionInfo?.transactionId as string | undefined;

    if (!userId || !transactionId) {
      return;
    }

    this.logger.log(
      `Consumption request for user ${userId}, transaction ${transactionId}`,
    );

    // Provide consumption data to Apple (e.g., how many coins were consumed)
    await this.provideConsumptionData(userId, transactionId);
  }

  /**
   * Handles a renewal extension notification.
   */
  private async handleRenewalExtension(data: Record<string, unknown>): Promise<void> {
    const userId = data?.appAccountToken as string | undefined;
    const extensionLength = data?.extensionLength as number | undefined;

    if (!userId) {
      return;
    }

    this.logger.log(
      `User ${userId} received renewal extension of ${extensionLength} days`,
    );

    // Extend the user's subscription period
    await this.extendSubscription(userId, extensionLength);
  }

  /**
   * Updates the user's subscription status in the database.
   */
  private async updateSubscriptionStatus(
    userId: string,
    productId: string | null,
    status: string,
    transactionId: string | null,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        product_id: productId,
        status,
        transaction_id: transactionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      this.logger.error(
        `Failed to update subscription for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Updates the auto-renew status for a user.
   */
  private async updateAutoRenewStatus(
    userId: string,
    autoRenew: boolean,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('subscriptions')
      .update({ auto_renew: autoRenew, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to update auto-renew status for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Updates the renewal product for a user.
   */
  private async updateRenewalProduct(
    userId: string,
    newProductId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('subscriptions')
      .update({
        renewal_product_id: newProductId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to update renewal product for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Notifies the user about a failed renewal.
   */
  private notifyUserAboutFailedRenewal(
    userId: string,
    gracePeriodExpiresDate: string,
  ): void {
    // Placeholder: send push notification or in-app message
    this.logger.log(
      `Would notify user ${userId} about failed renewal, grace until ${gracePeriodExpiresDate}`,
    );
  }

  /**
   * Revokes coins for a refunded transaction.
   */
  private async revokeCoinsForRefund(
    userId: string,
    transactionId: string,
    _refundAmount: number,
  ): Promise<void> {
    // Determine how many coins were associated with the refunded purchase
    const coinsToRevoke = await this.getCoinsForTransaction(transactionId);
    if (coinsToRevoke <= 0) {
      return;
    }

    const supabase = this.supabaseService.getClient();

    // Deduct coins from user balance
    const { data: user } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (!user) {
      return;
    }

    const newBalance = Math.max(0, user.coins_balance - coinsToRevoke);

    await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    this.logger.log(
      `Revoked ${coinsToRevoke} coins from user ${userId} due to refund`,
    );
  }

  /**
   * Retrieves the number of coins associated with a specific transaction.
   */
  private async getCoinsForTransaction(transactionId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('coin_purchases')
      .select('coins_added')
      .eq('transaction_id', transactionId)
      .single();

    const row = data as { coins_added?: number } | null;
    return row?.coins_added ?? 0;
  }

  /**
   * Revokes subscription benefits for a user.
   */
  private async revokeSubscriptionBenefits(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Set user back to free tier
    const { error } = await supabase
      .from('users')
      .update({
        is_vip: false,
        vip_tier: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to revoke subscription benefits for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Notifies the user about a price increase.
   */
  private notifyUserAboutPriceIncrease(userId: string, newPrice: number): void {
    // Placeholder: send push notification or in-app message
    this.logger.log(
      `Would notify user ${userId} about price increase to ${newPrice}`,
    );
  }

  /**
   * Provides consumption data to Apple for a specific transaction.
   */
  private provideConsumptionData(userId: string, transactionId: string): void {
    // Placeholder: In production, send consumption data to Apple's API
    this.logger.log(
      `Would provide consumption data for user ${userId}, transaction ${transactionId}`,
    );
  }

  /**
   * Extends the user's subscription period.
   */
  private async extendSubscription(
    userId: string,
    extensionDays: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('expires_at')
      .eq('user_id', userId)
      .single();

    if (!subscription) {
      return;
    }

    const currentExpiry = new Date(subscription.expires_at);
    const newExpiry = new Date(
      currentExpiry.getTime() + extensionDays * 24 * 60 * 60 * 1000,
    );

    const { error } = await supabase
      .from('subscriptions')
      .update({
        expires_at: newExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(
        `Failed to extend subscription for user ${userId}: ${error.message}`,
      );
    }
  }
}
