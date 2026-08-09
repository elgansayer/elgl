import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from './monetisation.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
    signedRenewalInfo?: string;
  };
}

interface AppleTransactionInfo {
  originalTransactionId: string;
  productId: string;
  appAccountToken?: string;
  transactionId: string;
  expiresDate: number;
  purchaseDate: number;
}

@Injectable()
export class AppleNotificationService {
  private readonly rootCAs: string[];

  constructor(
    @InjectPinoLogger(AppleNotificationService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    @Inject(forwardRef(() => MonetisationService))
    private readonly monetisationService: MonetisationService,
  ) {
    this.rootCAs = [
      this.configService.get<string>('APPLE_ROOT_CA_CERT_1') || '',
      this.configService.get<string>('APPLE_ROOT_CA_CERT_2') || '',
    ].filter(Boolean);
  }

  async handleNotification(
    payload: unknown,
  ): Promise<{ received: boolean; status: string }> {
    this.logger.info(`Received Apple App Store Server Notification`);

    const payloadRecord = payload as Record<string, unknown>;
    const signedPayload = payloadRecord?.signedPayload as string | undefined;
    if (!signedPayload) {
      this.logger.warn('Apple notification missing signedPayload');
      return { received: true, status: 'ignored' };
    }

    try {
      // Verify the JWS signature
      const verifiedPayload = this.verifyJwsPayload(signedPayload);

      const { notificationType, subtype, data } = verifiedPayload;

      // Handle subscription lifecycle events
      if (this.isSubscriptionActiveEvent(notificationType, subtype)) {
        await this.handleSubscriptionActive(notificationType, subtype, data);
      } else if (this.isSubscriptionExpiredEvent(notificationType, subtype)) {
        await this.handleSubscriptionExpired(notificationType, subtype, data);
      } else {
        this.logger.info(
          `Unhandled notification type: ${notificationType}/${subtype}`,
        );
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to process Apple notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw - return success to Apple to avoid retries
      return { received: true, status: 'error' };
    }

    return { received: true, status: 'processed' };
  }

  private isSubscriptionActiveEvent(
    notificationType: string,
    subtype?: string,
  ): boolean {
    const activeTypes = [
      'SUBSCRIBED',
      'DID_RENEW',
      'RENEWAL',
      'DID_CHANGE_RENEWAL_PREF',
      'DID_CHANGE_RENEWAL_STATUS',
    ];

    if (!activeTypes.includes(notificationType)) return false;

    // For DID_CHANGE_RENEWAL_STATUS, only handle when auto-renew is enabled
    if (
      notificationType === 'DID_CHANGE_RENEWAL_STATUS' &&
      subtype === 'AUTO_RENEW_DISABLED'
    ) {
      return false;
    }

    return true;
  }

  private isSubscriptionExpiredEvent(
    notificationType: string,
    subtype?: string,
  ): boolean {
    const expiredTypes = [
      'EXPIRED',
      'CANCEL',
      'REFUND',
      'REFUND_DECLINED',
      'CONSUMPTION_REQUEST',
      'RENEWAL_EXTENSION',
      'REVOKE',
    ];

    if (expiredTypes.includes(notificationType)) return true;

    // DID_CHANGE_RENEWAL_STATUS with AUTO_RENEW_DISABLED means user turned off auto-renew
    if (
      notificationType === 'DID_CHANGE_RENEWAL_STATUS' &&
      subtype === 'AUTO_RENEW_DISABLED'
    ) {
      return true;
    }

    return false;
  }

  private async handleSubscriptionActive(
    notificationType: string,
    subtype: string | undefined,
    data: AppleNotificationPayload['data'],
  ): Promise<void> {
    const transactionInfo = this.decodeTransactionInfo(
      data?.signedTransactionInfo,
    );
    if (!transactionInfo) {
      this.logger.warn('No transaction info in subscription active event');
      return;
    }

    const userId = transactionInfo.appAccountToken;
    if (!userId) {
      this.logger.warn('No appAccountToken in transaction info');
      return;
    }

    const tier = this.mapProductIdToTier(transactionInfo.productId);

    this.logger.info(
      `Activating subscription for user ${userId}, tier: ${tier}`,
    );
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      true,
      tier,
    );

    // Store the original transaction ID for future reference
    await this.storeAppleTransaction(userId, transactionInfo);
  }

  private async handleSubscriptionExpired(
    notificationType: string,
    subtype: string | undefined,
    data: AppleNotificationPayload['data'],
  ): Promise<void> {
    const transactionInfo = this.decodeTransactionInfo(
      data?.signedTransactionInfo,
    );
    if (!transactionInfo) {
      this.logger.warn('No transaction info in subscription expired event');
      return;
    }

    const userId = transactionInfo.appAccountToken;
    if (!userId) {
      this.logger.warn('No appAccountToken in transaction info');
      return;
    }

    this.logger.info(`Deactivating subscription for user ${userId}`);
    await this.monetisationService.updateVipStatusFromWebhook(
      userId,
      false,
      null,
    );
  }

  private verifyJwsPayload(signedPayload: string): AppleNotificationPayload {
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid JWS format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header to get the key ID and algorithm
    const headerStr = Buffer.from(headerB64, 'base64url').toString('utf-8');
    const header = JSON.parse(headerStr) as { x5c?: string[] };

    // Verify the signature using Apple's root CA
    const verified = this.verifySignature(
      `${headerB64}.${payloadB64}`,
      signatureB64,
      header,
    );

    if (!verified) {
      throw new BadRequestException('JWS signature verification failed');
    }

    // Decode payload
    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    return JSON.parse(payloadStr) as AppleNotificationPayload;
  }

  private verifySignature(
    signedContent: string,
    signatureB64: string,
    header: { x5c?: string[] },
  ): boolean {
    try {
      // Apple uses ES256 (ECDSA with P-256) for JWS signatures
      // The x5c header contains the certificate chain
      const x5c = header.x5c;
      if (!x5c || !Array.isArray(x5c) || x5c.length === 0) {
        this.logger.warn('No x5c certificate chain in JWS header');
        return false;
      }

      // Build certificate chain from x5c
      const certs = x5c.map((cert: string) => {
        const pemHeader = '-----BEGIN CERTIFICATE-----\n';
        const pemFooter = '\n-----END CERTIFICATE-----';
        // Split into 64-char lines
        const body = cert.match(/.{1,64}/g)?.join('\n') || cert;
        return `${pemHeader}${body}${pemFooter}`;
      });

      // Verify the certificate chain against Apple's root CA
      const leafCert = new crypto.X509Certificate(certs[0]);

      // Verify chain
      for (let i = 0; i < certs.length - 1; i++) {
        const cert = new crypto.X509Certificate(certs[i]);
        const issuerCert = new crypto.X509Certificate(certs[i + 1]);

        if (!cert.verify(issuerCert.publicKey)) {
          this.logger.warn(
            `Certificate chain verification failed at index ${i}`,
          );
          return false;
        }
      }

      // Verify the last certificate is signed by one of Apple's root CAs
      if (this.rootCAs.length > 0) {
        const lastCert = new crypto.X509Certificate(certs[certs.length - 1]);
        let rootVerified = false;

        for (const rootCA of this.rootCAs) {
          try {
            const rootCert = new crypto.X509Certificate(rootCA);
            if (lastCert.verify(rootCert.publicKey)) {
              rootVerified = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (!rootVerified) {
          this.logger.warn(
            'Could not verify certificate chain against Apple root CAs',
          );
          return false;
        }
      }

      // Verify the signature on the content
      const signature = Buffer.from(signatureB64, 'base64url');
      const verify = crypto.createVerify('SHA256');
      verify.update(signedContent);

      return verify.verify(leafCert.publicKey, signature);
    } catch (error: unknown) {
      this.logger.error(
        `Signature verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  private decodeTransactionInfo(
    signedTransactionInfo?: string,
  ): AppleTransactionInfo | null {
    if (!signedTransactionInfo) return null;

    try {
      const parts = signedTransactionInfo.split('.');
      if (parts.length !== 3) return null;

      const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadStr) as {
        originalTransactionId: string;
        productId: string;
        appAccountToken?: string;
        transactionId: string;
        expiresDate: number;
        purchaseDate: number;
      };

      return {
        originalTransactionId: payload.originalTransactionId,
        productId: payload.productId,
        appAccountToken: payload.appAccountToken,
        transactionId: payload.transactionId,
        expiresDate: payload.expiresDate,
        purchaseDate: payload.purchaseDate,
      };
    } catch {
      return null;
    }
  }

  private mapProductIdToTier(productId: string): string {
    return (
      this.subscriptionPlansService.getTierByProductId(productId) ??
      'consumer_8_ukp_10_usd'
    );
  }

  private async storeAppleTransaction(
    userId: string,
    transactionInfo: AppleTransactionInfo,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('apple_subscriptions').upsert(
      {
        user_id: userId,
        original_transaction_id: transactionInfo.originalTransactionId,
        product_id: transactionInfo.productId,
        transaction_id: transactionInfo.transactionId,
        expires_date: new Date(transactionInfo.expiresDate).toISOString(),
        purchase_date: new Date(transactionInfo.purchaseDate).toISOString(),
        status: 'active',
      },
      {
        onConflict: 'original_transaction_id',
        ignoreDuplicates: false,
      },
    );

    if (error) {
      this.logger.error(
        `Failed to store Apple transaction: ${(error as Error).message}`,
      );
    }
  }
}
