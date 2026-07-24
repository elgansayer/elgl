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

interface DeveloperMetricRow {
  user_id: string;
  total_api_calls_today: number;
  avg_latency_ms: number;
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
    private readonly appleReceiptValidatorService: AppleReceiptValidatorService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      },
    );
  }

  /**
   * PRIVATE: VIP status must only be changed via verified payment webhooks.
   * This method is called exclusively from webhook handlers.
   */
  private async updateVipStatus(
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

  /**
   * Public method for internal use by webhook handlers and receipt validators.
   * Do NOT expose this as a controller endpoint.
   */
  async updateVipStatusFromWebhook(
    userId: string,
    isVip: boolean,
    vipTier: string | null,
  ): Promise<void> {
    return this.updateVipStatus(userId, isVip, vipTier);
  }

  async createCheckoutSession(
    userId: string,
    planId: string,
    interval: 'month' | 'year',
  ): Promise<{ sessionUrl: string; sessionId: string }> {
    const plan = this.subscriptionPlansService.getPlanById(planId);
    if (!plan) {
      throw new NotFoundException(`Plan "${planId}" not found`);
    }

    const priceId =
      interval === 'year' && plan.stripe_price_id_yearly
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id;

    if (!priceId) {
      throw new BadRequestException(
        `No Stripe price ID configured for plan "${planId}" (interval: ${interval})`,
      );
    }

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
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    this.logger.log(`Received verified Stripe Webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: Record<string, string>;
      };
      const metadata = session.metadata;
      if (metadata?.userId) {
        // Determine tier based on interval
        const tier =
          metadata.interval === 'year'
            ? 'developer_20_ukp_26_usd'
            : 'consumer_8_ukp_10_usd';

        await this.updateVipStatusFromWebhook(metadata.userId, true, tier);
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

  async handleAppleWebhook(
    payload: any,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.log('Received Apple App Store Server Notification');
    return await this.appleNotificationService.handleNotification(payload);
  }

  async handleGoogleWebhook(
    payload: any,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.log('Received Google Play Developer Notification');
    return await this.googlePlayNotificationService.handleNotification(payload);
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
    const user = response.data as UserVipRow;

    if (!user.is_vip) {
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
      rate_limit_rpm: user.vip_tier === 'developer' ? 600 : 60,
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

    const metricResponse = await supabase
      .from('developer_metrics')
      .select('user_id, total_api_calls_today, avg_latency_ms')
      .eq('user_id', userId)
      .single();
    const metric: DeveloperMetricRow | null = metricResponse.data;

    return {
      api_key: user.developer_api_key || null,
      tier: user.vip_tier || (user.is_vip ? 'consumer' : 'free'),
      total_api_calls_today: metric?.total_api_calls_today ?? 0,
      avg_latency_ms: metric?.avg_latency_ms ?? 0,
      pricing_info:
        'Developer Tier: 20 UKP / $26 USD per month | Consumer VIP: 8 UKP / $10 USD per month',
    };
  }

  async getDiagnosticLogs(): Promise<DeveloperDiagnosticLogRow[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('developer_diagnostic_logs')
      .select('id, user_id, category, status, message, created_at')
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
      // Android restore purchases not fully implemented yet
      this.logger.warn(
        `Android restore purchases not fully implemented for user ${userId}`,
      );
      return { received: true, status: 'not_implemented' };
    }
    throw new BadRequestException('Invalid platform');
  }
}
