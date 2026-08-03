import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Stripe from 'stripe';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateDiagnosticLogDto,
  AppleReceiptValidationResponse,
} from './dto/monetisation.dto';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

export interface UserVipRow {
  id: string;
  is_vip: boolean;
  vip_tier?: string | null;
  developer_api_key?: string | null;
  email?: string;
}

export interface DeveloperDiagnosticLogRow {
  id: string;
  user_id: string | null;
  category: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';
  status: 'info' | 'success' | 'warn';
  message: string;
  created_at: string;
}

@Injectable()
export class MonetisationService {
  private readonly logger = new Logger(MonetisationService.name);

  private readonly stripe: Stripe;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AppleNotificationService))
    private readonly appleNotificationService: AppleNotificationService,
    @Inject(forwardRef(() => GooglePlayNotificationService))
    private readonly googlePlayNotificationService: GooglePlayNotificationService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    @Inject(forwardRef(() => AppleReceiptValidatorService))
    private readonly appleReceiptValidatorService: AppleReceiptValidatorService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2023-10-16',
      },
    );
  }

  /**
   * VIP status must only be changed via verified payment webhooks.
   * This method is called exclusively from webhook handlers (Stripe, Apple, Google Play).
   */
  async updateVipStatusFromWebhook(
    userId: string,
    isVip: boolean,
    vipTier: string | null,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({
        is_vip: isVip,
        vip_tier: vipTier,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to update VIP status for user ${userId}: ${error.message}`,
      );
      throw new Error('Failed to update VIP status');
    }

    this.logger.log(
      `VIP status updated for user ${userId}: isVip=${isVip}, tier=${vipTier}`,
    );
  }

  private getPriceIdForPlan(
    planId: string,
    interval: 'month' | 'year',
  ): string {
    if (
      planId === 'consumer_50_ukp_63_usd' ||
      planId === 'consumer_6_ukp_8_usd'
    ) {
      const priceId = this.configService.get<string>('STRIPE_YEARLY_PRICE_ID');
      if (!priceId) {
        throw new BadRequestException(
          `Stripe price ID for plan "${planId}" (interval: ${interval}) is not configured. Ensure STRIPE_YEARLY_PRICE_ID environment variable is set.`,
        );
      }
      return priceId;
    }
    if (planId === 'consumer_8_ukp_10_usd') {
      const priceId = this.configService.get<string>('STRIPE_MONTHLY_PRICE_ID');
      if (!priceId) {
        throw new BadRequestException(
          `Stripe price ID for plan "${planId}" (interval: ${interval}) is not configured. Ensure STRIPE_MONTHLY_PRICE_ID environment variable is set.`,
        );
      }
      return priceId;
    }
    if (planId === 'pro_12_ukp_15_usd') {
      const envKey =
        interval === 'year'
          ? 'STRIPE_PRO_YEARLY_PRICE_ID'
          : 'STRIPE_PRO_MONTHLY_PRICE_ID';
      const priceId = this.configService.get<string>(envKey);
      if (!priceId) {
        throw new BadRequestException(
          `Stripe price ID for plan "${planId}" (interval: ${interval}) is not configured. Ensure ${envKey} environment variable is set.`,
        );
      }
      return priceId;
    }
    // fallback for developer_20_ukp_26_usd or other future plans
    const envKey =
      interval === 'year'
        ? 'STRIPE_DEVELOPER_YEARLY_PRICE_ID'
        : 'STRIPE_DEVELOPER_MONTHLY_PRICE_ID';
    const priceId = this.configService.get<string>(envKey);
    if (!priceId) {
      throw new BadRequestException(
        `Stripe price ID for plan "${planId}" (interval: ${interval}) is not configured. Ensure ${envKey} environment variable is set.`,
      );
    }
    return priceId;
  }

  /**
   * Verifies the Stripe webhook signature using the configured webhook secret.
   * Returns a verified Stripe event object.
   */
  private verifyStripeSignature(
    rawBody: Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      const error = err as Error;
      const message = error.message || 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }
  }

  async createCheckoutSession(
    userId: string,
    planId: string,
    interval: 'month' | 'year',
  ): Promise<{ sessionUrl: string; sessionId: string }> {
    const priceId = this.getPriceIdForPlan(planId, interval);

    const tierMap: Record<string, string> = {
      consumer_8_ukp_10_usd: 'consumer',
      consumer_50_ukp_63_usd: 'consumer',
      consumer_6_ukp_8_usd: 'consumer',
      pro_12_ukp_15_usd: 'pro',
      developer_20_ukp_26_usd: 'developer',
    };
    const tier = tierMap[planId] ?? 'consumer';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        planId,
        interval,
        tier,
      },
      success_url: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200'}/subscription/cancel`,
    });

    return {
      sessionUrl: session.url || '',
      sessionId: session.id,
    };
  }

  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; status: string }> {
    const event = this.verifyStripeSignature(rawBody, signature);

    this.logger.log(`Received verified Stripe Webhook event: ${event.type}`);

    // Helper to determine tier based on planId metadata (or fallback to interval)
    const tierForPlan = (planId?: string, interval?: string): string => {
      if (!planId) {
        return interval === 'year' ? 'developer' : 'consumer';
      }
      if (planId.startsWith('consumer_')) return 'consumer';
      if (planId.startsWith('pro_')) return 'pro';
      if (planId.startsWith('developer_')) return 'developer';
      return interval === 'year' ? 'developer' : 'consumer';
    };

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const obj = event.data.object as {
        metadata?: Record<string, string>;
        status?: string;
      };
      const metadata = obj.metadata;
      if (metadata?.userId) {
        const tier =
          metadata.tier ?? tierForPlan(metadata.planId, metadata.interval);
        const isActive =
          !obj.status || obj.status === 'active' || obj.status === 'trialing';
        await this.updateVipStatusFromWebhook(
          metadata.userId,
          isActive,
          isActive ? tier : null,
        );
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as {
        metadata?: Record<string, string>;
      };
      const metadata = subscription.metadata;
      if (metadata?.userId) {
        await this.updateVipStatusFromWebhook(metadata.userId, false, null);
      }
    }

    return { received: true, status: 'processed' };
  }

  async handleAppleNotification(
    dto: AppleNotificationDto,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.log(
      `Processing Apple Notification: ${dto.notificationType}, ${dto.subtype}`,
    );

    if (dto.receiptData) {
      const validationResult =
        await this.appleReceiptValidatorService.validateReceipt(
          'userId-placeholder', // Replace with actual user ID resolution logic
          dto.receiptData,
          false,
        );

      if (validationResult.valid) {
        await this.updateVipStatusFromWebhook(
          'userId-placeholder', // Replace with actual user ID resolution logic
          true,
          'tier-placeholder', // Replace with actual tier resolution logic
        );
        return { received: true, status: 'processed' };
      }
    }

    return { received: true, status: 'ignored' };
  }

  async handleGoogleNotification(
    dto: GoogleNotificationDto,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.log(
      `Processing Google Notification: ${dto.productId}, ${dto.purchaseToken}`,
    );

    const purchaseDetails =
      await this.googlePlayNotificationService.getSubscriptionPurchaseDetails(
        dto.productId,
        dto.purchaseToken,
      );

    if (purchaseDetails) {
      await this.updateVipStatusFromWebhook(
        dto.userId || 'userId-placeholder', // Replace with actual user ID resolution logic
        true,
        'tier-placeholder', // Replace with actual tier resolution logic
      );
      return { received: true, status: 'processed' };
    }

    return { received: true, status: 'ignored' };
  }

  async generateApiKey(
    userId: string,
  ): Promise<{ api_key: string; tier: string; rate_limit_rpm: number }> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('id, is_vip, vip_tier, developer_api_key')
      .eq('id', userId)
      .single();
    if (!response.data) throw new NotFoundException('User not found');
    const user = response.data as unknown as UserVipRow;

    const isDeveloperTier =
      user.is_vip && (user.vip_tier ?? '').startsWith('developer');
    if (!isDeveloperTier) {
      throw new ForbiddenException(
        'Developer API Access is reserved for active Developer Tier subscribers (20 UKP / $26 USD per month).',
      );
    }

    const apiKey = `ht_dev_${crypto.randomBytes(16).toString('hex')}`;
    await supabase
      .from('users')
      .update({ developer_api_key: apiKey })
      .eq('id', userId);

    return {
      api_key: apiKey,
      tier: user.vip_tier || 'consumer',
      rate_limit_rpm: user.vip_tier?.startsWith('developer') ? 600 : 60,
    };
  }

  async getDeveloperAnalytics(userId: string): Promise<{
    api_key: string | null;
    tier: string;
    total_api_calls_today: number;
    avg_latency_ms: number;
    pricing_info: string;
  }> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('id, is_vip, vip_tier, developer_api_key')
      .eq('id', userId)
      .single();
    if (!response.data) throw new NotFoundException('User not found');
    const user = response.data as UserVipRow;

    const isDeveloperTier =
      user.is_vip && (user.vip_tier ?? '').startsWith('developer');
    if (!isDeveloperTier) {
      throw new ForbiddenException(
        'Developer Analytics are only available to active Developer Tier subscribers (20 UKP / $26 USD per month).',
      );
    }

    const metricResponse = await supabase
      .from('developer_metrics')
      .select('user_id, total_api_calls_today, avg_latency_ms')
      .eq('user_id', userId)
      .single();
    const metric = metricResponse.data as unknown as {
      total_api_calls_today?: number;
      avg_latency_ms?: number;
    } | null;

    return {
      api_key: user.developer_api_key || null,
      tier: user.vip_tier || (user.is_vip ? 'consumer' : 'free'),
      total_api_calls_today: metric?.total_api_calls_today ?? 0,
      avg_latency_ms: metric?.avg_latency_ms ?? 0,
      pricing_info:
        'Developer Tier: 20 UKP / $26 USD per month | Consumer VIP: 8 UKP / $10 USD per month or 6 UKP / $8 USD annual equivalent',
    };
  }

  async getDiagnosticLogs(
    userId: string,
  ): Promise<DeveloperDiagnosticLogRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data: userCheck } = await supabase
      .from('users')
      .select('is_vip, vip_tier')
      .eq('id', userId)
      .single();
    if (
      !userCheck ||
      !userCheck.is_vip ||
      !(userCheck.vip_tier && userCheck.vip_tier.startsWith('developer'))
    ) {
      throw new ForbiddenException(
        'Diagnostic logs are only available to active Developer Tier subscribers (20 UKP / $26 USD per month).',
      );
    }

    const response = await supabase
      .from('developer_diagnostic_logs')
      .select('id, user_id, category, status, message, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (response.error || !response.data) {
      return [];
    }

    return response.data;
  }

  async createDiagnosticLog(
    userId: string,
    dto: CreateDiagnosticLogDto,
  ): Promise<DeveloperDiagnosticLogRow> {
    const supabase = this.supabaseService.getClient();
    const { data: userCheck } = await supabase
      .from('users')
      .select('is_vip, vip_tier')
      .eq('id', userId)
      .single();
    if (
      !userCheck ||
      !userCheck.is_vip ||
      !(userCheck.vip_tier ?? '').startsWith('developer')
    ) {
      throw new ForbiddenException(
        'Diagnostic logs are only available to active Developer Tier subscribers (20 UKP / $26 USD per month).',
      );
    }
    const response = await supabase
      .from('developer_diagnostic_logs')
      .insert({
        user_id: userId,
        category: dto.category,
        status: dto.status,
        message: dto.message,
      })
      .select('id, user_id, category, status, message, created_at')
      .single();

    if (response.error || !response.data) {
      throw new BadRequestException(
        `Failed to create diagnostic log: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    return response.data;
  }

  /**
   * Restore previous purchases (Apple App Store / Google Play).
   * Validates receipt and updates VIP status accordingly.
   */
  async restorePurchases(
    userId: string,
    platform: 'ios' | 'android',
    receiptData?: string,
  ): Promise<{ received: boolean; status: string }> {
    if (platform === 'ios') {
      if (!receiptData) {
        throw new BadRequestException('Receipt data is required for iOS');
      }
      const validationResult: AppleReceiptValidationResponse =
        await this.appleReceiptValidatorService.validateReceipt(
          userId,
          receiptData,
          false,
        );
      if (validationResult.valid && validationResult.product_id) {
        const tier = this.subscriptionPlansService.getTierByProductId(
          validationResult.product_id,
        );
        if (tier) {
          await this.updateVipStatusFromWebhook(userId, true, tier);
          return { received: true, status: 'restored' };
        }
      }
      return { received: true, status: 'no_valid_subscription' };
    } else if (platform === 'android') {
      if (!receiptData) {
        throw new BadRequestException('Receipt data is required for Android');
      }
      let purchaseToken: string;
      let productId: string | undefined;
      try {
        const parsed = JSON.parse(receiptData);
        purchaseToken = parsed.purchaseToken;
        productId = parsed.productId;
      } catch {
        // fallback: treat receiptData as raw purchase token
        purchaseToken = receiptData;
        productId = undefined;
      }
      if (!productId) {
        throw new BadRequestException(
          'productId must be provided in receipt_data JSON',
        );
      }

      const purchaseDetails =
        await this.googlePlayNotificationService.getSubscriptionPurchaseDetails(
          productId,
          purchaseToken,
        );

      if (!purchaseDetails) {
        this.logger.warn(
          `Android restore: no purchase details for token ${purchaseToken}`,
        );
        return { received: true, status: 'no_valid_subscription' };
      }

      const expiryMillis = Number(purchaseDetails.expiryTimeMillis);
      const isCurrentlyEntitled =
        Number.isFinite(expiryMillis) && expiryMillis > Date.now();

      if (!isCurrentlyEntitled) {
        this.logger.warn(
          `Android restore: purchase not currently entitled for token ${purchaseToken}`,
        );
        return { received: true, status: 'no_valid_subscription' };
      }

      // Determine which user this token belongs to
      const existingUserId =
        await this.googlePlayNotificationService.getUserIdByPurchaseToken(
          purchaseToken,
        );
      if (!existingUserId) {
        // Store the purchase under the calling user's id
        await this.googlePlayNotificationService.storePurchaseToken(
          userId,
          purchaseToken,
          productId,
        );
      } else if (existingUserId !== userId) {
        this.logger.warn(
          `Purchase token ${purchaseToken} already belongs to user ${existingUserId}, but restore called for user ${userId}`,
        );
      }

      const tier = this.subscriptionPlansService.getTierByProductId(productId);
      if (tier) {
        await this.updateVipStatusFromWebhook(userId, true, tier);
        return { received: true, status: 'restored' };
      }

      return { received: true, status: 'no_valid_subscription' };
    }
    throw new BadRequestException('Invalid platform');
  }

  /**
   * Deduct coins from user's balance.
   * Throws BadRequestException if insufficient coins.
   */
  async deductCoins(userId: string, amount: number): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new Error(
        `Failed to fetch user balance: ${fetchError?.message ?? 'user not found'}`,
      );
    }

    const currentBalance = user.coins_balance ?? 0;
    if (currentBalance < amount) {
      throw new BadRequestException(
        `Insufficient coins. You have ${currentBalance} coins but need ${amount}. Please purchase a coin pack from the store.`,
      );
    }

    const newBalance = currentBalance - amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to deduct coins: ${updateError.message}`);
    }

    this.logger.log(
      `Deducted ${amount} coins from user ${userId}, remaining ${newBalance}`,
    );

    return newBalance;
  }

  async getCoinsBalance(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data: user, error } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();
    if (error || !user) {
      throw new Error(
        `Failed to fetch user balance: ${error?.message ?? 'user not found'}`,
      );
    }
    const balance = user.coins_balance ?? 0;
    return balance;
  }

  async addCoins(userId: string, amount: number): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();
    if (fetchError || !user) {
      throw new Error(
        `Failed to fetch user balance: ${fetchError?.message ?? 'user not found'}`,
      );
    }
    const currentBalance = user.coins_balance ?? 0;
    const newBalance = currentBalance + amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);
    if (updateError) {
      throw new Error(`Failed to add coins: ${updateError.message}`);
    }
    this.logger.log(
      `Added ${amount} coins to user ${userId}, new balance ${newBalance}`,
    );
    return newBalance;
  }

  /**
   * Return subscription details for the given user.
   */
  async getSubscriptionDetails(
    userId: string,
  ): Promise<{ isVip: boolean; vipTier: string | null; email?: string }> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('is_vip, vip_tier, email')
      .eq('id', userId)
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to fetch subscription details: ${error?.message ?? 'user not found'}`,
      );
    }
    return {
      isVip: data.is_vip ?? false,
      vipTier: data.vip_tier ?? null,
      email: data.email ?? undefined,
    };
  }

  /**
   * Cancel the user's active Stripe subscription.
   * Uses Stripe's API to list subscriptions by metadata user ID and cancels the first active one.
   */
  async cancelSubscription(userId: string): Promise<{ message: string }> {
    // Locate the Stripe subscriptions that belong to this user
    const subscriptions = await this.stripe.subscriptions.list({
      limit: 10,
    });

    // Iterate through subscriptions to find the one with matching metadata
    const userSubscription = subscriptions.data.find((sub) => {
      return sub.metadata?.userId === userId && sub.status === 'active';
    });

    if (!userSubscription) {
      throw new BadRequestException(
        'No active subscription found for this user.',
      );
    }

    // Cancel at period end (graceful cancellation)
    await this.stripe.subscriptions.update(userSubscription.id, {
      cancel_at_period_end: true,
    });

    this.logger.log(
      `Subscription ${userSubscription.id} set to cancel at period end for user ${userId}`,
    );

    return {
      message:
        'Your subscription will be cancelled at the end of the current billing period. You will retain VIP benefits until that date.',
    };
  }
}
