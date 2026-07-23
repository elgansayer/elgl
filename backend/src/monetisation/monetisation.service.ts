import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Stripe from 'stripe';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDiagnosticLogDto } from './dto/monetisation.dto';

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

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

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
      this.logger.error(`Failed to update VIP status for user ${userId}: ${error.message}`);
      throw new Error('Failed to update VIP status');
    }

    this.logger.log(`VIP status updated for user ${userId}: isVip=${isVip}, tier=${vipTier}`);
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

  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ received: boolean; status: string }> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    const stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-02-24.acacia' as any,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Received verified Stripe Webhook event: ${event.type}`);
    const supabase = this.supabaseService.getClient();

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created'
    ) {
      const session = event.data.object as any;
      const metadata = session.metadata;
      if (metadata?.userId && metadata?.tier) {
        await this.updateVipStatusFromWebhook(metadata.userId, true, metadata.tier);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;
      const metadata = subscription.metadata;
      if (metadata?.userId) {
        await this.updateVipStatusFromWebhook(metadata.userId, false, null);
      }
    }

    return { received: true, status: 'processed' };
  }

  async handleAppleWebhook(payload: any): Promise<{ received: boolean; status: string }> {
    this.logger.log(`Received Apple webhook: ${JSON.stringify(payload)}`);
    
    // Extract the signed payload from the notification
    const signedPayload = payload?.signedPayload;
    if (!signedPayload) {
      this.logger.warn('Apple webhook missing signedPayload');
      return { received: true, status: 'ignored' };
    }

    try {
      // Decode the JWS payload (Apple uses ES256 algorithm)
      const parts = signedPayload.split('.');
      if (parts.length !== 3) {
        this.logger.warn('Invalid JWS format in Apple notification');
        return { received: true, status: 'ignored' };
      }

      const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const notificationPayload = JSON.parse(payloadStr);

      const { notificationType, subtype, data } = notificationPayload;
      
      // Handle subscription lifecycle events
      if (notificationType === 'SUBSCRIBED' || 
          (notificationType === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_ENABLED') ||
          (notificationType === 'DID_RENEW')) {
        
        const transactionInfo = data?.signedTransactionInfo;
        if (transactionInfo) {
          const txParts = transactionInfo.split('.');
          if (txParts.length === 3) {
            const txPayloadStr = Buffer.from(txParts[1], 'base64url').toString('utf-8');
            const txPayload = JSON.parse(txPayloadStr);
            
            const originalTransactionId = txPayload.originalTransactionId;
            const productId = txPayload.productId;
            const userId = txPayload.appAccountToken; // Set during purchase
            
            if (userId && productId) {
              const supabase = this.supabaseService.getClient();
              
              // Map product ID to tier
              const tier = productId.includes('developer') 
                ? 'developer_20_ukp_26_usd' 
                : 'consumer_8_ukp_10_usd';
              
              // Update user VIP status
              await this.updateVipStatusFromWebhook(userId, true, tier);
            }
          }
        }
      } else if (notificationType === 'EXPIRED' || 
                 notificationType === 'DID_CHANGE_RENEWAL_STATUS' && subtype === 'AUTO_RENEW_DISABLED' ||
                 notificationType === 'CANCEL') {
        
        const transactionInfo = data?.signedTransactionInfo;
        if (transactionInfo) {
          const txParts = transactionInfo.split('.');
          if (txParts.length === 3) {
            const txPayloadStr = Buffer.from(txParts[1], 'base64url').toString('utf-8');
            const txPayload = JSON.parse(txPayloadStr);
            
            const userId = txPayload.appAccountToken;
            
            if (userId) {
              const supabase = this.supabaseService.getClient();
              
              // Downgrade user
              await this.updateVipStatusFromWebhook(userId, false, null);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to process Apple webhook', error);
    }

    return { received: true, status: 'processed' };
  }

  async handleGoogleWebhook(payload: any): Promise<{ received: boolean; status: string }> {
    this.logger.log(`Received Google webhook: ${JSON.stringify(payload)}`);
    
    try {
      // Google Play Developer Notifications structure
      const message = payload?.message;
      if (!message) {
        this.logger.warn('Google webhook missing message');
        return { received: true, status: 'ignored' };
      }

      // Decode base64-encoded data
      const data = message.data;
      if (!data) {
        this.logger.warn('Google webhook missing data');
        return { received: true, status: 'ignored' };
      }

      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      const notificationData = JSON.parse(decodedData);

      const { subscriptionNotification, testNotification } = notificationData;

      if (testNotification) {
        this.logger.log('Received Google Play test notification');
        return { received: true, status: 'processed' };
      }

      if (subscriptionNotification) {
        const { notificationType, purchaseToken, subscriptionId } = subscriptionNotification;
        
        // notificationType: 1=SUBSCRIBED, 2=RESUBSCRIBED, 3=RENEWED, 4=CANCELLED, 5=EXPIRED
        const isActive = [1, 2, 3].includes(notificationType);
        const isCancelled = [4, 5].includes(notificationType);

        if (isActive || isCancelled) {
          // Look up the user by purchase token (stored during initial purchase)
          const supabase = this.supabaseService.getClient();
          
          if (isActive) {
            const tier = subscriptionId?.includes('developer') 
              ? 'developer_20_ukp_26_usd' 
              : 'consumer_8_ukp_10_usd';
            
            // Find user by purchase token
            const { data: purchaseData } = await supabase
              .from('google_purchases')
              .select('user_id')
              .eq('purchase_token', purchaseToken)
              .single();

            if (purchaseData?.user_id) {
              await this.updateVipStatusFromWebhook(purchaseData.user_id, true, tier);
            }
          } else {
            // Find user by purchase token
            const { data: purchaseData } = await supabase
              .from('google_purchases')
              .select('user_id')
              .eq('purchase_token', purchaseToken)
              .single();

            if (purchaseData?.user_id) {
              await this.updateVipStatusFromWebhook(purchaseData.user_id, false, null);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to process Google webhook', error);
    }

    return { received: true, status: 'processed' };
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
}
