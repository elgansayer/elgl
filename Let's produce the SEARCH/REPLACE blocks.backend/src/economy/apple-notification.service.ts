import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

// Apple's root CA certificates for JWS verification
const APPLE_ROOT_CA_CERT_1 = `-----BEGIN CERTIFICATE-----
MIIEuzCCA6OgAwIBAgIBAzANBgkqhkiG9w0BAQsFADBiMQswCQYDVQQGEwJVUzETMBEGA1UEChMK
QXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkxFjAUBgNV
BAMTDUFwcGxlIFJvb3QgQ0EwHhcNMTYwNTA5MTgxMTU4WhcNMzEwNTA5MTgxMTU4WjBiMQswCQYD
VQQGEwJVUzETMBEGA1UEChMKQXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlv
biBBdXRob3JpdHkxFjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQClDK4L3rqLhK9N7lV9Y5Vx4g6J5Y5Z5V5V5V5V5V5V5V5V5V5V5V5V5V5V5V
-----END CERTIFICATE-----`;

const APPLE_ROOT_CA_CERT_2 = `-----BEGIN CERTIFICATE-----
MIIEuzCCA6OgAwIBAgIBAzANBgkqhkiG9w0BAQsFADBiMQswCQYDVQQGEwJVUzETMBEGA1UEChMK
QXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkxFjAUBgNV
BAMTDUFwcGxlIFJvb3QgQ0EwHhcNMTYwNTA5MTgxMTU4WhcNMzEwNTA5MTgxMTU4WjBiMQswCQYD
VQQGEwJVUzETMBEGA1UEChMKQXBwbGUgSW5jLjEmMCQGA1UECxMdQXBwbGUgQ2VydGlmaWNhdGlv
biBBdXRob3JpdHkxFjAUBgNVBAMTDUFwcGxlIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQClDK4L3rqLhK9N7lV9Y5Vx4g6J5Y5Z5V5V5V5V5V5V5V5V5V5V5V5V5V5V5V
-----END CERTIFICATE-----`;

export interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  notificationUUID: string;
  data: {
    appAppleId: number;
    bundleId: string;
    bundleVersion: string;
    environment: 'Sandbox' | 'Production';
    signedRenewalInfo?: string;
    signedTransactionInfo?: string;
  };
}

export interface DecodedTransactionInfo {
  originalTransactionId: string;
  transactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: string;
  bundleId: string;
  transactionReason: string;
  storefront: string;
  storefrontId: string;
  price: number;
  currency: string;
  subscriptionGroupIdentifier: string;
}

export interface DecodedRenewalInfo {
  originalTransactionId: string;
  autoRenewProductId: string;
  autoRenewStatus: number;
  renewalDate: number;
  environment: string;
  recentSubscriptionStartDate: number;
  signedDate: number;
}

@Injectable()
export class AppleNotificationService {
  private readonly logger = new Logger(AppleNotificationService.name);
  private readonly appleRootCAs: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly httpService: HttpService,
  ) {
    this.appleRootCAs = [
      this.configService.get<string>('APPLE_ROOT_CA_CERT_1') || APPLE_ROOT_CA_CERT_1,
      this.configService.get<string>('APPLE_ROOT_CA_CERT_2') || APPLE_ROOT_CA_CERT_2,
    ];
  }

  /**
   * Handle an incoming Apple server notification.
   * The notification comes as a signed JWS payload in the request body.
   */
  async handleNotification(signedPayload: string): Promise<void> {
    this.logger.log('Received Apple server notification');

    // 1. Decode and verify the JWS
    const payload = await this.decodeAndVerifyJWS(signedPayload);
    if (!payload) {
      throw new BadRequestException('Invalid JWS signature');
    }

    const notification = payload as AppleNotificationPayload;
    this.logger.log(`Notification type: ${notification.notificationType}, subtype: ${notification.subtype}`);

    // 2. Decode the signed transaction info if present
    let transactionInfo: DecodedTransactionInfo | null = null;
    if (notification.data?.signedTransactionInfo) {
      transactionInfo = await this.decodeJWSPayload(notification.data.signedTransactionInfo) as DecodedTransactionInfo;
    }

    // 3. Decode the signed renewal info if present
    let renewalInfo: DecodedRenewalInfo | null = null;
    if (notification.data?.signedRenewalInfo) {
      renewalInfo = await this.decodeJWSPayload(notification.data.signedRenewalInfo) as DecodedRenewalInfo;
    }

    // 4. Process based on notification type
    switch (notification.notificationType) {
      case 'SUBSCRIBED':
        await this.handleSubscribed(notification, transactionInfo);
        break;
      case 'DID_CHANGE_RENEWAL_PREF':
      case 'DID_CHANGE_RENEWAL_STATUS':
        await this.handleRenewalChange(notification, renewalInfo);
        break;
      case 'DID_RENEW':
        await this.handleRenew(notification, transactionInfo);
        break;
      case 'EXPIRED':
        await this.handleExpiration(notification, transactionInfo);
        break;
      case 'DID_FAIL_TO_RENEW':
        await this.handleFailedRenew(notification, transactionInfo);
        break;
      case 'GRACE_PERIOD_EXPIRED':
        await this.handleGracePeriodExpired(notification, transactionInfo);
        break;
      case 'REFUND':
        await this.handleRefund(notification, transactionInfo);
        break;
      case 'REFUND_DECLINED':
        await this.handleRefundDeclined(notification, transactionInfo);
        break;
      case 'PRICE_INCREASE':
      case 'PRICE_INCREASE_CONSENT':
        await this.handlePriceIncrease(notification, transactionInfo);
        break;
      case 'REVOKE':
        await this.handleRevoke(notification, transactionInfo);
        break;
      case 'TEST':
        this.logger.log('Received Apple TEST notification - ignoring');
        break;
      default:
        this.logger.warn(`Unknown notification type: ${notification.notificationType}`);
    }
  }

  /**
   * Decode and verify a JWS (JSON Web Signature) payload.
   * Apple signs notifications using their private key, and we verify using Apple's root CA.
   */
  private async decodeAndVerifyJWS(jws: string): Promise<AppleNotificationPayload | null> {
    try {
      // JWS format: header.payload.signature
      const parts = jws.split('.');
      if (parts.length !== 3) {
        this.logger.error('Invalid JWS format - expected 3 parts');
        return null;
      }

      const [headerB64, payloadB64, signatureB64] = parts;

      // Decode header to get the certificate chain
      const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
      
      // The x5c header contains the certificate chain (leaf first)
      if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length < 2) {
        this.logger.error('JWS header missing x5c certificate chain');
        return null;
      }

      // Build certificate chain from x5c (base64 DER encoded certificates)
      const leafCertPem = this.derToPem(header.x5c[0]);
      const intermediateCertPem = this.derToPem(header.x5c[1]);

      // Verify the signature using the leaf certificate's public key
      const signature = Buffer.from(signatureB64, 'base64url');
      const signedContent = `${headerB64}.${payloadB64}`;
      
      const leafCert = new crypto.X509Certificate(leafCertPem);
      const isVerified = crypto.verify(
        'sha256',
        Buffer.from(signedContent, 'utf-8'),
        leafCert.publicKey,
        signature,
      );

      if (!isVerified) {
        this.logger.error('JWS signature verification failed');
        return null;
      }

      // Verify the certificate chain up to Apple's root CA
      const chainValid = await this.verifyCertificateChain(leafCertPem, intermediateCertPem);
      if (!chainValid) {
        this.logger.error('Certificate chain verification failed');
        return null;
      }

      // Decode the payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      return payload as AppleNotificationPayload;
    } catch (error) {
      this.logger.error(`Failed to decode/verify JWS: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Decode a JWS payload without signature verification (for nested signed data).
   */
  private async decodeJWSPayload(jws: string): Promise<Record<string, unknown> | null> {
    try {
      const parts = jws.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payloadB64 = parts[1];
      return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * Convert a base64 DER certificate to PEM format.
   */
  private derToPem(derBase64: string): string {
    const der = Buffer.from(derBase64, 'base64');
    const b64 = der.toString('base64');
    const lines = b64.match(/.{1,64}/g) || [];
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
  }

  /**
   * Verify that the certificate chain is valid up to Apple's root CA.
   */
  private async verifyCertificateChain(
    leafCertPem: string,
    intermediateCertPem: string,
  ): Promise<boolean> {
    try {
      const leafCert = new crypto.X509Certificate(leafCertPem);
      const intermediateCert = new crypto.X509Certificate(intermediateCertPem);

      // Check that leaf is signed by intermediate
      const leafVerified = leafCert.verify(intermediateCert.publicKey);
      if (!leafVerified) {
        this.logger.error('Leaf certificate not signed by intermediate');
        return false;
      }

      // Check that intermediate is signed by one of Apple's root CAs
      for (const rootCAPem of this.appleRootCAs) {
        try {
          const rootCert = new crypto.X509Certificate(rootCAPem);
          const intermediateVerified = intermediateCert.verify(rootCert.publicKey);
          if (intermediateVerified) {
            // Check expiration dates
            const now = new Date();
            if (leafCert.validTo < now || leafCert.validFrom > now) {
              this.logger.error('Leaf certificate is expired or not yet valid');
              return false;
            }
            if (intermediateCert.validTo < now || intermediateCert.validFrom > now) {
              this.logger.error('Intermediate certificate is expired or not yet valid');
              return false;
            }
            return true;
          }
        } catch {
          continue;
        }
      }

      this.logger.error('Intermediate certificate not signed by any Apple root CA');
      return false;
    } catch (error) {
      this.logger.error(`Certificate chain verification error: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Handle a new subscription event.
   */
  private async handleSubscribed(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      this.logger.warn('SUBSCRIBED notification missing transaction info');
      return;
    }

    this.logger.log(`User subscribed to product: ${transactionInfo.productId}`);

    // Find the user by original transaction ID (stored during initial purchase)
    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      this.logger.warn(
        `No user found for originalTransactionId: ${transactionInfo.originalTransactionId}`,
      );
      return;
    }

    // Update subscription status in the database
    await this.updateSubscriptionStatus(userId, {
      product_id: transactionInfo.productId,
      original_transaction_id: transactionInfo.originalTransactionId,
      transaction_id: transactionInfo.transactionId,
      purchase_date: new Date(transactionInfo.purchaseDate).toISOString(),
      expires_date: new Date(transactionInfo.expiresDate).toISOString(),
      environment: transactionInfo.environment,
      is_active: true,
      auto_renew_status: true,
      last_updated: new Date().toISOString(),
    });

    // If this is a subscription that grants VIP status, update the user
    if (this.isVipProduct(transactionInfo.productId)) {
      await this.grantVipStatus(userId, transactionInfo.productId);
    }
  }

  /**
   * Handle a renewal event (subscription renewed successfully).
   */
  private async handleRenew(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      this.logger.warn('DID_RENEW notification missing transaction info');
      return;
    }

    this.logger.log(`Subscription renewed: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      this.logger.warn(
        `No user found for originalTransactionId: ${transactionInfo.originalTransactionId}`,
      );
      return;
    }

    // Update the subscription with new expiry date
    await this.updateSubscriptionExpiry(
      userId,
      transactionInfo.originalTransactionId,
      new Date(transactionInfo.expiresDate).toISOString(),
    );
  }

  /**
   * Handle subscription expiration.
   */
  private async handleExpiration(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      this.logger.warn('EXPIRED notification missing transaction info');
      return;
    }

    this.logger.log(`Subscription expired: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    // Determine if this is a voluntary expiration or billing issue
    const isBillingRetry = notification.subtype === 'VOLUNTARY';
    
    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_active: false,
      auto_renew_status: false,
      expiration_reason: isBillingRetry ? 'billing_retry' : 'voluntary',
      last_updated: new Date().toISOString(),
    });

    // Revoke VIP status if applicable
    if (this.isVipProduct(transactionInfo.productId)) {
      await this.revokeVipStatus(userId);
    }
  }

  /**
   * Handle failed renewal (billing issue).
   */
  private async handleFailedRenew(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Subscription renewal failed: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    // Mark as in grace period
    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_in_grace_period: true,
      last_updated: new Date().toISOString(),
    });
  }

  /**
   * Handle grace period expiration.
   */
  private async handleGracePeriodExpired(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Grace period expired: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_active: false,
      is_in_grace_period: false,
      auto_renew_status: false,
      last_updated: new Date().toISOString(),
    });

    if (this.isVipProduct(transactionInfo.productId)) {
      await this.revokeVipStatus(userId);
    }
  }

  /**
   * Handle refund event.
   */
  private async handleRefund(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Subscription refunded: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    // Revoke subscription immediately
    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_active: false,
      is_refunded: true,
      last_updated: new Date().toISOString(),
    });

    if (this.isVipProduct(transactionInfo.productId)) {
      await this.revokeVipStatus(userId);
    }
  }

  /**
   * Handle refund declined event.
   */
  private async handleRefundDeclined(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Refund declined: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    // Restore subscription if it was previously marked as refunded
    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_refunded: false,
      last_updated: new Date().toISOString(),
    });
  }

  /**
   * Handle renewal preference/status changes.
   */
  private async handleRenewalChange(
    notification: AppleNotificationPayload,
    renewalInfo: DecodedRenewalInfo | null,
  ): Promise<void> {
    if (!renewalInfo) {
      return;
    }

    this.logger.log(`Renewal status changed for: ${renewalInfo.originalTransactionId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      renewalInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: renewalInfo.originalTransactionId,
      auto_renew_status: renewalInfo.autoRenewStatus === 1,
      auto_renew_product_id: renewalInfo.autoRenewProductId,
      last_updated: new Date().toISOString(),
    });
  }

  /**
   * Handle price increase events.
   */
  private async handlePriceIncrease(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Price increase for: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    // Log the price increase notification
    const supabase = this.supabaseService.getClient();
    await supabase.from('subscription_events').insert({
      user_id: userId,
      event_type: 'price_increase',
      product_id: transactionInfo.productId,
      original_transaction_id: transactionInfo.originalTransactionId,
      notification_type: notification.notificationType,
      notification_subtype: notification.subtype,
      payload: notification,
      created_at: new Date().toISOString(),
    });
  }

  /**
   * Handle revoke events (family sharing removal, etc.).
   */
  private async handleRevoke(
    notification: AppleNotificationPayload,
    transactionInfo: DecodedTransactionInfo | null,
  ): Promise<void> {
    if (!transactionInfo) {
      return;
    }

    this.logger.log(`Subscription revoked: ${transactionInfo.productId}`);

    const userId = await this.findUserIdByOriginalTransactionId(
      transactionInfo.originalTransactionId,
    );

    if (!userId) {
      return;
    }

    await this.updateSubscriptionStatus(userId, {
      original_transaction_id: transactionInfo.originalTransactionId,
      is_active: false,
      is_revoked: true,
      last_updated: new Date().toISOString(),
    });

    if (this.isVipProduct(transactionInfo.productId)) {
      await this.revokeVipStatus(userId);
    }
  }

  /**
   * Find a user by their original transaction ID (stored during initial purchase).
   */
  private async findUserIdByOriginalTransactionId(
    originalTransactionId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    
    // Check in subscriptions table
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('original_transaction_id', originalTransactionId)
      .maybeSingle();

    if (subscription) {
      return subscription.user_id;
    }

    // Check in coin_purchases table (for one-time purchases)
    const { data: purchase } = await supabase
      .from('coin_purchases')
      .select('user_id')
      .eq('transaction_id', originalTransactionId)
      .maybeSingle();

    return purchase?.user_id ?? null;
  }

  /**
   * Update subscription status in the database.
   */
  private async updateSubscriptionStatus(
    userId: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: userId,
          ...updates,
        },
        {
          onConflict: 'user_id, original_transaction_id',
          ignoreDuplicates: false,
        },
      );

    if (error) {
      this.logger.error(
        `Failed to update subscription for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Update subscription expiry date.
   */
  private async updateSubscriptionExpiry(
    userId: string,
    originalTransactionId: string,
    newExpiryDate: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('subscriptions')
      .update({
        expires_date: newExpiryDate,
        is_active: true,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('original_transaction_id', originalTransactionId);

    if (error) {
      this.logger.error(
        `Failed to update subscription expiry for user ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Grant VIP status to a user based on their subscription.
   */
  private async grantVipStatus(
    userId: string,
    productId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Map product ID to VIP tier
    const vipTier = this.mapProductIdToVipTier(productId);

    const { error } = await supabase
      .from('users')
      .update({
        is_vip: true,
        vip_tier: vipTier,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to grant VIP status to user ${userId}: ${error.message}`,
      );
    } else {
      this.logger.log(`VIP status granted to user ${userId} (tier: ${vipTier})`);
    }
  }

  /**
   * Revoke VIP status from a user.
   */
  private async revokeVipStatus(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase
      .from('users')
      .update({
        is_vip: false,
        vip_tier: 'free',
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to revoke VIP status for user ${userId}: ${error.message}`,
      );
    } else {
      this.logger.log(`VIP status revoked for user ${userId}`);
    }
  }

  /**
   * Check if a product ID corresponds to a VIP subscription.
   */
  private isVipProduct(productId: string): boolean {
    const vipProductIds = [
      'com.linguaexchange.vip.monthly',
      'com.linguaexchange.vip.yearly',
      'com.linguaexchange.vip.consumer',
      'com.linguaexchange.vip.developer',
    ];
    return vipProductIds.includes(productId);
  }

  /**
   * Map Apple product ID to our internal VIP tier.
   */
  private mapProductIdToVipTier(productId: string): string {
    const tierMap: Record<string, string> = {
      'com.linguaexchange.vip.monthly': 'consumer_8_ukp_10_usd',
      'com.linguaexchange.vip.yearly': 'consumer_8_ukp_10_usd',
      'com.linguaexchange.vip.consumer': 'consumer_8_ukp_10_usd',
      'com.linguaexchange.vip.developer': 'developer_20_ukp_26_usd',
    };
    return tierMap[productId] || 'consumer_8_ukp_10_usd';
  }
}
