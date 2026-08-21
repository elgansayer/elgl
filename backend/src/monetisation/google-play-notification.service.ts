import {
  Injectable,
  Inject,
  forwardRef,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from './monetisation.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

// Google signs every Cloud Pub/Sub push request with an OIDC ID token in the
// `Authorization: Bearer <token>` header - see
// https://cloud.google.com/pubsub/docs/push#authentication
const GOOGLE_OIDC_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_OIDC_ISSUERS: [string, string] = [
  'accounts.google.com',
  'https://accounts.google.com',
];

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
  private readonly jwksClient = jwksClient({
    jwksUri: GOOGLE_OIDC_JWKS_URI,
    cache: true,
    cacheMaxAge: 3600_000,
    rateLimit: true,
  });

  constructor(
    @InjectPinoLogger(GooglePlayNotificationService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    @Inject(forwardRef(() => MonetisationService))
    private readonly monetisationService: MonetisationService,
  ) {}

  async handleNotification(
    payload: unknown,
    authorizationHeader?: string,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.info('Received Google Play Developer Notification');

    // Reject anything that isn't a genuine push from our Cloud Pub/Sub
    // subscription before trusting a single field of the body. Unlike the
    // Apple path (which verifies a JWS chain embedded in the payload
    // itself), Google notifications carry no signature in the body - the
    // only proof of authenticity is this bearer token, so it must be
    // checked first and any failure must propagate (not be swallowed).
    await this.verifyPubSubAuthorization(authorizationHeader);

    try {
      // Google Play Developer Notifications come as a Pub/Sub message wrapper
      const payloadRecord = payload as Record<string, unknown>;
      const message = payloadRecord?.message as
        Record<string, unknown> | undefined;
      if (!message) {
        this.logger.warn('Google notification missing message');
        return { received: true, status: 'ignored' };
      }

      // Decode base64-encoded data
      const data = message.data as string | undefined;
      if (!data) {
        this.logger.warn('Google notification missing data');
        return { received: true, status: 'ignored' };
      }

      const decodedData = Buffer.from(data, 'base64').toString('utf-8');
      const notificationData = JSON.parse(
        decodedData,
      ) as GooglePlayNotification;

      // Handle test notification
      if (notificationData.testNotification) {
        this.logger.info(
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
        this.logger.info('Unhandled Google Play notification type');
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process Google notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - return success to avoid retries
      return { received: true, status: 'error' };
    }

    return { received: true, status: 'processed' };
  }

  /**
   * Verifies the OIDC bearer token Cloud Pub/Sub push subscriptions attach
   * to real RTDN deliveries: signature (against Google's published JWKS),
   * audience, issuer, and the pushing service account's identity. Throws
   * `UnauthorizedException` on any failure - callers must let it propagate
   * rather than swallowing it, since that's the only thing standing between
   * this endpoint and an attacker-forged payload.
   */
  private async verifyPubSubAuthorization(
    authorizationHeader?: string,
  ): Promise<void> {
    const audience = this.configService.get<string>('GOOGLE_PUBSUB_AUDIENCE');
    const expectedServiceAccountEmail = this.configService.get<string>(
      'GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL',
    );

    if (!audience || !expectedServiceAccountEmail) {
      this.logger.error(
        'GOOGLE_PUBSUB_AUDIENCE / GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL not configured - rejecting Google Play webhook',
      );
      throw new UnauthorizedException(
        'Push subscription verification is not configured',
      );
    }

    if (!authorizationHeader?.startsWith('Bearer ')) {
      this.logger.warn('Google Play webhook rejected: missing bearer token');
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorizationHeader.slice('Bearer '.length);
    const decoded = jwt.decode(token, { complete: true });
    const kid =
      decoded && typeof decoded !== 'string' ? decoded.header.kid : undefined;

    if (!kid) {
      this.logger.warn('Google Play webhook rejected: token missing kid');
      throw new UnauthorizedException('Invalid push subscription token');
    }

    let verifiedPayload: jwt.JwtPayload;
    try {
      const signingKey = await this.jwksClient.getSigningKey(kid);
      verifiedPayload = jwt.verify(token, signingKey.getPublicKey(), {
        algorithms: ['RS256'],
        audience,
        issuer: GOOGLE_OIDC_ISSUERS,
      }) as jwt.JwtPayload;
    } catch (error) {
      this.logger.warn(
        `Google Play webhook rejected: invalid OIDC token (${(error as Error).message})`,
      );
      throw new UnauthorizedException('Invalid push subscription token');
    }

    if (
      verifiedPayload.email !== expectedServiceAccountEmail ||
      verifiedPayload.email_verified !== true
    ) {
      this.logger.warn(
        `Google Play webhook rejected: unexpected identity "${verifiedPayload.email}"`,
      );
      throw new UnauthorizedException('Unexpected push subscription identity');
    }
  }

  private async handleSubscriptionNotification(
    notification: GooglePlayNotification['subscriptionNotification'],
  ): Promise<void> {
    if (!notification) return;

    const { notificationType, purchaseToken, subscriptionId } = notification;

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
    void purchaseToken;
    void subscriptionId;

    if (isActive) {
      await this.handleSubscriptionActive(notification);
    } else if (isExpired) {
      await this.handleSubscriptionExpired(notification);
    } else {
      this.logger.info(`Unhandled notification type: ${notificationType}`);
    }
  }

  private async handleSubscriptionActive(
    notification: NonNullable<
      GooglePlayNotification['subscriptionNotification']
    >,
  ): Promise<void> {
    const { purchaseToken, subscriptionId } = notification;

    // A purchaseToken already existing in `google_play_purchases` only
    // proves we have seen it before (e.g. from an earlier legitimate
    // notification, or from the client submitting it via
    // POST /economy/purchase-coins) - it is not proof that *this*
    // notification is a genuine renewal. Always re-check the token against
    // the Google Play Developer API (the source of truth) before granting
    // entitlement, even on this "known token" fast path.
    const purchaseDetails = await this.getSubscriptionPurchaseDetails(
      subscriptionId,
      purchaseToken,
    );

    if (
      !purchaseDetails ||
      !this.isPurchaseCurrentlyEntitled(purchaseDetails)
    ) {
      this.logger.warn(
        `Refusing to grant VIP for purchase token ${purchaseToken}: not a currently active entitlement per Google Play API`,
      );
      return;
    }

    let userId = await this.getUserIdByPurchaseToken(purchaseToken);
    if (!userId) {
      this.logger.info(
        `Purchase token ${purchaseToken} not found locally, resolving user from Google Play API`,
      );
      const extractedUserId =
        purchaseDetails.obfuscatedExternalAccountId ||
        purchaseDetails.developerPayload;

      if (!extractedUserId) {
        this.logger.warn(
          `No user found for purchase token ${purchaseToken} and Google Play API returned no account identifier`,
        );
        return;
      }

      userId = extractedUserId;
      await this.storePurchaseToken(userId, purchaseToken, subscriptionId);
    }

    const tier = this.mapSubscriptionIdToTier(subscriptionId);
    this.logger.info(
      `Activating subscription for user ${userId}, tier: ${tier}`,
    );
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      true,
      tier,
    );
  }

  private isPurchaseCurrentlyEntitled(
    purchase: GooglePlaySubscriptionPurchase,
  ): boolean {
    const expiryMillis = Number(purchase.expiryTimeMillis);
    return Number.isFinite(expiryMillis) && expiryMillis > Date.now();
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

    this.logger.info(`Deactivating subscription for user ${userId}`);
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      false,
      null,
    );
  }

  public async getSubscriptionPurchaseDetails(
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
    } catch (error: unknown) {
      this.logger.error(
        `Failed to get subscription purchase details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  public async getUserIdByPurchaseToken(
    purchaseToken: string,
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { data } = await supabase
      .from('google_play_purchases')
      .select('user_id')
      .eq('purchase_token', purchaseToken)
      .single();

    const row = data as { user_id?: string } | null;
    return row?.user_id || null;
  }

  public async storePurchaseToken(
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
    return (
      this.subscriptionPlansService.getTierByProductId(subscriptionId) ??
      'consumer_8_ukp_10_usd'
    );
  }
}
