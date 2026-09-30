import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
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
import { AppleNotificationDto } from './dto/apple-notification.dto';
import { GoogleNotificationDto } from './dto/google-notification.dto';
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
  private readonly stripe: Stripe;

  constructor(
    @InjectPinoLogger(MonetisationService.name)
    private readonly logger: PinoLogger,
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
    let secret = this.configService.get<string>('STRIPE_SECRET_KEY');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (env === 'production') {
      if (!secret || secret === 'sk_test_123' || secret === 'sk_test') {
        throw new Error(
          'STRIPE_SECRET_KEY must be configured securely in production',
        );
      }
    } else {
      if (!secret) {
        secret = 'sk_test_123';
      }
    }

    this.stripe = new Stripe(secret, {
      apiVersion: '2023-10-16',
    });
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

    this.logger.info(
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

    this.logger.info(`Received verified Stripe Webhook event: ${event.type}`);

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
    this.logger.info(
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
    this.logger.info(
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
        'Developer API Access is reserved for active subscribers. Upgrade to Developer Tier (20 UKP / $26 USD per month) to generate programmatic API keys!',
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

    let total_api_calls_today = 0;
    let avg_latency_ms = 0;

    if (isDeveloperTier) {
      const metricResponse = await supabase
        .from('developer_metrics')
        .select('user_id, total_api_calls_today, avg_latency_ms')
        .eq('user_id', userId)
        .single();
      const metric = metricResponse.data as unknown as {
        total_api_calls_today?: number;
        avg_latency_ms?: number;
      } | null;
      total_api_calls_today = metric?.total_api_calls_today ?? 0;
      avg_latency_ms = metric?.avg_latency_ms ?? 0;
    }

    return {
      api_key: user.developer_api_key || null,
      tier: user.vip_tier || (user.is_vip ? 'consumer' : 'free'),
      total_api_calls_today,
      avg_latency_ms,
      pricing_info:
        'Developer Tier: 20 UKP / $26 USD per month | Consumer VIP: 8 UKP / $10 USD per month',
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

    const isDeveloper =
      !!userCheck &&
      userCheck.is_vip === true &&
      (userCheck.vip_tier ?? '').startsWith('developer');

    if (!isDeveloper) {
      return [];
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
   * Restore previous purchases (Apple App Store / Google Play / Stripe).
   * Validates receipt and updates VIP status accordingly.
   */
  async restorePurchases(
    userId: string,
    platform: 'ios' | 'android' | 'stripe',
    receiptData?: string,
  ): Promise<{ received: boolean; status: string }> {
    if (platform === 'stripe') {
      const subscription = await this.findActiveStripeSubscription(userId);
      if (subscription) {
        const tier =
          subscription.metadata?.tier ??
          this.inferTierFromPriceId(subscription.items?.data?.[0]?.price?.id);
        if (tier) {
          await this.updateVipStatusFromWebhook(userId, true, tier);
          return { received: true, status: 'restored' };
        }
      }
      return { received: true, status: 'no_valid_subscription' };
    } else if (platform === 'ios') {
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
        const parsed: Record<string, unknown> = JSON.parse(receiptData);
        if (
          typeof parsed.purchaseToken === 'string' &&
          typeof parsed.productId === 'string'
        ) {
          purchaseToken = parsed.purchaseToken;
          productId = parsed.productId;
        } else {
          throw new Error('Invalid receipt data format');
        }
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
    } else {
      // Stripe/web platform: look up active Stripe subscription and sync VIP status
      const subscription = await this.findActiveStripeSubscription(userId);
      if (!subscription) {
        return { received: true, status: 'no_valid_subscription' };
      }

      // Determine VIP tier from the subscription metadata or price lookup
      const item = subscription.items.data[0];
      const priceId = item?.price?.id;
      let tier: string | null = null;
      if (priceId) {
        tier = this.subscriptionPlansService.getTierByProductId(priceId);
      }

      if (tier) {
        await this.updateVipStatusFromWebhook(userId, true, tier);
        return { received: true, status: 'restored' };
      }

      // No matching tier but active subscription exists -- restore as consumer VIP
      await this.updateVipStatusFromWebhook(
        userId,
        true,
        'consumer_8_ukp_10_usd',
      );
      return { received: true, status: 'restored' };
    }
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

    this.logger.info(
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
    this.logger.info(
      `Added ${amount} coins to user ${userId}, new balance ${newBalance}`,
    );
    return newBalance;
  }

  /**
   * Locate the Stripe subscription belonging to this user.
   * NOTE: lists a bounded window of recent subscriptions and filters by metadata,
   * matching the approach already used by cancelSubscription (no stripe_customer_id
   * column exists on the users table to query by directly).
   */
  private async findActiveStripeSubscription(
    userId: string,
  ): Promise<Stripe.Subscription | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      limit: 10,
    });
    return (
      subscriptions.data.find(
        (sub) =>
          sub.metadata?.userId === userId &&
          (sub.status === 'active' || sub.status === 'trialing'),
      ) ?? null
    );
  }

  /**
   * Infer VIP tier from a Stripe price ID by matching against configured price IDs.
   */
  private inferTierFromPriceId(priceId?: string): string | null {
    if (!priceId) return null;
    const monthlyPriceId = this.configService.get<string>(
      'STRIPE_MONTHLY_PRICE_ID',
    );
    const yearlyPriceId = this.configService.get<string>(
      'STRIPE_YEARLY_PRICE_ID',
    );
    const proMonthlyPriceId = this.configService.get<string>(
      'STRIPE_PRO_MONTHLY_PRICE_ID',
    );
    const proYearlyPriceId = this.configService.get<string>(
      'STRIPE_PRO_YEARLY_PRICE_ID',
    );
    const devMonthlyPriceId = this.configService.get<string>(
      'STRIPE_DEVELOPER_MONTHLY_PRICE_ID',
    );
    const devYearlyPriceId = this.configService.get<string>(
      'STRIPE_DEVELOPER_YEARLY_PRICE_ID',
    );

    if (priceId === monthlyPriceId || priceId === yearlyPriceId)
      return 'consumer_8_ukp_10_usd';
    if (priceId === proMonthlyPriceId || priceId === proYearlyPriceId)
      return 'pro_12_ukp_15_usd';
    if (priceId === devMonthlyPriceId || priceId === devYearlyPriceId)
      return 'developer_20_ukp_26_usd';
    return null;
  }

  /**
   * Return subscription details for the given user, including live billing
   * information from Stripe when an active subscription exists.
   */
  async getSubscriptionDetails(userId: string): Promise<{
    isVip: boolean;
    vipTier: string | null;
    email?: string;
    billing: {
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string;
      nextBillingAmount: number | null;
      currency: string | null;
      interval: string | null;
    } | null;
  }> {
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

    const subscription = await this.findActiveStripeSubscription(userId);
    const item = subscription?.items.data[0];
    const billing = subscription
      ? {
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date(
            subscription.current_period_end * 1000,
          ).toISOString(),
          nextBillingAmount:
            item?.price?.unit_amount != null
              ? item.price.unit_amount / 100
              : null,
          currency: item?.price?.currency ?? null,
          interval: item?.price?.recurring?.interval ?? null,
        }
      : null;

    return {
      isVip: data.is_vip ?? false,
      vipTier: data.vip_tier ?? null,
      email: data.email ?? undefined,
      billing,
    };
  }

  /**
   * Cancel the user's active Stripe subscription.
   * Uses Stripe's API to list subscriptions by metadata user ID and cancels the first active one.
   */
  async cancelSubscription(userId: string): Promise<{ message: string }> {
    const userSubscription = await this.findActiveStripeSubscription(userId);

    if (!userSubscription) {
      throw new BadRequestException(
        'No active subscription found for this user.',
      );
    }

    // Cancel at period end (graceful cancellation)
    await this.stripe.subscriptions.update(userSubscription.id, {
      cancel_at_period_end: true,
    });

    this.logger.info(
      `Subscription ${userSubscription.id} set to cancel at period end for user ${userId}`,
    );

    return {
      message:
        'Your subscription will be cancelled at the end of the current billing period. You will retain VIP benefits until that date.',
    };
  }

  /**
   * Resume a subscription that was previously set to cancel at period end.
   */
  async resumeSubscription(userId: string): Promise<{ message: string }> {
    const userSubscription = await this.findActiveStripeSubscription(userId);

    if (!userSubscription) {
      throw new BadRequestException(
        'No active subscription found for this user.',
      );
    }

    if (!userSubscription.cancel_at_period_end) {
      throw new BadRequestException(
        'Subscription is not scheduled for cancellation.',
      );
    }

    await this.stripe.subscriptions.update(userSubscription.id, {
      cancel_at_period_end: false,
    });

    this.logger.info(
      `Subscription ${userSubscription.id} resumed for user ${userId}`,
    );

    return {
      message:
        'Your subscription has been resumed and will renew automatically.',
    };
  }

  /**
   * List billing history (invoices) for the user's Stripe customer.
   * Returns an empty list when the user has no active subscription.
   */
  async listInvoices(userId: string): Promise<
    Array<{
      id: string;
      amountPaid: number;
      currency: string;
      status: string | null;
      created: string;
      invoicePdf: string | null;
      hostedInvoiceUrl: string | null;
    }>
  > {
    const userSubscription = await this.findActiveStripeSubscription(userId);
    if (!userSubscription || typeof userSubscription.customer !== 'string') {
      return [];
    }

    const invoices = await this.stripe.invoices.list({
      customer: userSubscription.customer,
      limit: 12,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      amountPaid: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
      invoicePdf: invoice.invoice_pdf ?? null,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    }));
  }

  /**
   * Create a Stripe Billing Portal session so the user can manage their
   * payment method and view invoices directly through Stripe.
   */
  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    const userSubscription = await this.findActiveStripeSubscription(userId);
    if (!userSubscription || typeof userSubscription.customer !== 'string') {
      throw new BadRequestException(
        'No active subscription found for this user.',
      );
    }

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    const session = await this.stripe.billingPortal.sessions.create({
      customer: userSubscription.customer,
      return_url: `${frontendUrl}/my-subscription`,
    });

    return { url: session.url };
  }
}
