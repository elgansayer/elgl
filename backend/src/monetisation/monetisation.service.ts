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
import {
  CreateDiagnosticLogDto,
  StripeWebhookDto,
  UpgradeVipDto,
} from './dto/monetisation.dto';

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

  async upgradeUser(userId: string, dto: UpgradeVipDto): Promise<UserVipRow> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .update({ is_vip: true, vip_tier: dto.tier })
      .eq('id', userId)
      .select('id, is_vip, vip_tier, developer_api_key, email')
      .single();

    if (response.error || !response.data) {
      throw new Error(
        `Failed to upgrade VIP status: ${response.error?.message ?? 'Unknown error'}`,
      );
    }

    return response.data;
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
      apiVersion: '2023-10-16' as any,
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
        await supabase
          .from('users')
          .update({ is_vip: true, vip_tier: metadata.tier })
          .eq('id', metadata.userId);
        this.logger.log(
          `Upgraded user ${metadata.userId} to VIP tier ${metadata.tier} via webhook.`,
        );
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;
      const metadata = subscription.metadata;
      if (metadata?.userId) {
        await supabase
          .from('users')
          .update({ is_vip: false, vip_tier: null })
          .eq('id', metadata.userId);
      }
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
