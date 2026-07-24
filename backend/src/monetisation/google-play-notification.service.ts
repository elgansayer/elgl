import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from './monetisation.service';

interface GooglePlayNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
  testNotification?: {
    version: string;
  };
}

interface GooglePlaySubscriptionPurchase {
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoResumeTimeMillis?: string;
  autoRenewing: boolean;
  purchaseType?: number;
  acknowledgementState: number;
  kind: string;
  developerPayload?: string;
  obfuscatedExternalAccountId?: string;
  obfuscatedExternalProfileId?: string;
  orderId: string;
  linkedPurchaseToken?: string;
  purchaseState: number;
  regionCode?: string;
}

@Injectable()
export class GooglePlayNotificationService {
  private readonly logger = new Logger(GooglePlayNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => MonetisationService))
    private readonly monetisationService: MonetisationService,
  ) {}

  async handleNotification(
    payload: any,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.log('Received Google Play Developer Notification');

    try {
      // Google Play Developer Notifications come as a Pub/Sub message wrapper
      const message: any = payload?.message;
      if (!message) {
        this.logger.warn('Google notification missing message');
        return { received: true, status: 'ignored' };
      }

      // Decode base64-encoded data
      const data: string | undefined = message.data;
      if (!data) {
        this.logger.warn('Google notification missing data');
        return { received: true, status: 'ignored' };
      }

      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      const notificationData: GooglePlayNotification = JSON.parse(decodedData);

      // Handle test notification
      if (notificationData.testNotification) {
        this.logger.log(
          'Received Google Play test notification - acknowledging',
        );
        return { received: true, status: 'processed' };
      }

      // Handle subscription notification
      if (notificationData.subscriptionNotification) {
        await this.handleSubscriptionNotification(
          notificationData.subscriptionNotification,
        );
      } else {
        this.logger.log('Unhandled Google Play notification type');
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process Google notification: ${(error as Error).message}`,
      );
      // Don't throw - return success to avoid retries
      return { received: true, status: 'error' };
    }

    return { received: true, status: 'processed' };
  }

  private async handleSubscriptionNotification(
    notification: GooglePlayNotification['subscriptionNotification'],
  ): Promise<void> {
    if (!notification) return;

    const {
      notificationType,
      purchaseToken,
      subscriptionId,
    }: {
      notificationType: number;
      purchaseToken: string;
      subscriptionId: string;
    } = notification;

    // notificationType mapping:
    // 1 = SUBSCRIBED (new subscription)
    // 2 = RESUBSCRIBED (user re-subscribed after cancellation)
    // 3 = RENEWED (subscription renewed)
    // 4 = CANCELLED (user cancelled, but still active until expiry)
    // 5 = EXPIRED (subscription expired)
    // 6 = ON_HOLD (payment pending)
    // 7 = RESTARTED (subscription restarted after hold)
    // 8 = PRICE_CHANGE_CONFIRMED
    // 9 = DEFERRED (renewal deferred)
    // 10 = PAUSED
    // 11 = PAUSE_SCHEDULE_CHANGED
    // 12 = REVOKED
    // 13 = RECOVERED

    const isActive = [1, 2, 3, 7, 13].includes(notificationType);
    const isExpired = [4, 5, 12].includes(notificationType);

    if (isActive) {
      await this.handleSubscriptionActive(notification);
    } else if (isExpired) {
      await this.handleSubscriptionExpired(notification);
    } else {
      this.logger.log(`Unhandled notification type: ${notificationType}`);
    }
  }

  private async handleSubscriptionActive(
    notification: NonNullable<
      GooglePlayNotification['subscriptionNotification']
    >,
  ): Promise<void> {
    const { purchaseToken, subscriptionId } = notification;

    // Get the user ID from our stored purchase record
    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      // If we don't have the purchase token stored yet, try to get it from Google Play API
      this.logger.log(
        `Purchase token ${purchaseToken} not found locally, fetching from Google Play`,
      );
      const purchaseDetails = await this.getSubscriptionPurchaseDetails(
        subscriptionId,
        purchaseToken,
      );

      if (purchaseDetails) {
        // Try to get user ID from developer payload or obfuscated account ID
        const extractedUserId =
          purchaseDetails.obfuscatedExternalAccountId ||
          purchaseDetails.developerPayload;

        if (extractedUserId) {
          await this.storePurchaseToken(
            extractedUserId,
            purchaseToken,
            subscriptionId,
          );
          const tier = this.mapSubscriptionIdToTier(subscriptionId);
          await this.monetisationService.updateVipStatusFromWebhook(
            extractedUserId,
            true,
            tier,
          );
        }
      }
      return;
    }

    const tier = this.mapSubscriptionIdToTier(subscriptionId);
    this.logger.log(
      `Activating subscription for user ${userId}, tier: ${tier}`,
    );
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      true,
      tier,
    );
  }

  private async handleSubscriptionExpired(
    notification: NonNullable<
      GooglePlayNotification['subscriptionNotification']
    >,
  ): Promise<void> {
    const { purchaseToken } = notification;

    const userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      this.logger.warn(`No user found for purchase token ${purchaseToken}`);
      return;
    }

    this.logger.log(`Deactivating subscription for user ${userId}`);
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      false,
      null,
    );
  }

  private async getSubscriptionPurchaseDetails(
    subscriptionId: string,
    purchaseToken: string,
  ): Promise<GooglePlaySubscriptionPurchase | null> {
    try {
      const packageName = this.configService.get<string>(
        'GOOGLE_PLAY_PACKAGE_NAME',
      );
      const accessToken = this.configService.get<string>(
        'GOOGLE_PLAY_ACCESS_TOKEN',
      );

      if (!packageName || !accessToken) {
        this.logger.warn('Google Play credentials not configured');
        return null;
      }

      const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return response.data as GooglePlaySubscriptionPurchase;
    } catch (error: any) {
      this.logger.error(
        `Failed to get subscription purchase details: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async getUserIdByPurchaseToken(
    purchaseToken: string,
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('google_play_purchases')
      .select('user_id')
      .eq('purchase_token', purchaseToken)
      .single();

    const row = data;
    return (row as any)?.user_id || null;
  }

  private async storePurchaseToken(
    userId: string,
    purchaseToken: string,
    subscriptionId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('google_play_purchases').upsert(
      {
        user_id: userId,
        purchase_token: purchaseToken,
        subscription_id: subscriptionId,
        status: 'active',
      },
      {
        onConflict: 'purchase_token',
        ignoreDuplicates: false,
      },
    );

    if (error) {
      this.logger.error(
        `Failed to store Google Play purchase: ${(error as Error).message}`,
      );
    }
  }

  private mapSubscriptionIdToTier(subscriptionId: string): string {
    if (
      subscriptionId.includes('developer') ||
      subscriptionId.includes('Developer')
    ) {
      return 'developer_20_ukp_26_usd';
    }
    return 'consumer_8_ukp_10_usd';
  }
}
