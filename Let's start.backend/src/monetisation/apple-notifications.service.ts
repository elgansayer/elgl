import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

interface AppleNotificationPayload {
  signedPayload: string;
}

interface AppleNotificationData {
  appAppleId: string;
  bundleId: string;
  bundleVersion: string;
  environment: 'Sandbox' | 'Production';
  signedRenewalInfo: string;
  signedTransactionInfo: string;
}

interface AppleTransactionInfo {
  originalTransactionId: string;
  transactionId: string;
  webOrderLineItemId: string;
  bundleId: string;
  productId: string;
  subscriptionGroupIdentifier: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  expiresDate: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: 'Sandbox' | 'Production';
  transactionReason: string;
  storefront: string;
  storefrontId: string;
  price: number;
  currency: string;
}

interface AppleRenewalInfo {
  originalTransactionId: string;
  autoRenewProductId: string;
  productId: string;
  autoRenewStatus: number;
  renewalDate: number;
  environment: 'Sandbox' | 'Production';
  recentSubscriptionStartDate: number;
  renewalPreference: string;
  signedDate: number;
}

// Map Apple product IDs to our tier system
const PRODUCT_TIER_MAP: Record<string, string> = {
  'com.hellotalk.vip.monthly': 'consumer_8_ukp_10_usd',
  'com.hellotalk.vip.yearly': 'consumer_8_ukp_10_usd',
  'com.hellotalk.developer.monthly': 'developer_20_ukp_26_usd',
  'com.hellotalk.developer.yearly': 'developer_20_ukp_26_usd',
};

@Injectable()
export class AppleNotificationsService {
  private readonly logger = new Logger(AppleNotificationsService.name);
  private readonly bundleId: string;
  private readonly appleRootCerts: crypto.X509Certificate[];

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.bundleId = this.configService.get<string>('APPLE_BUNDLE_ID') || 'com.hellotalk.app';
    
    // Load Apple root certificates from config
    const rootCertPems = [
      this.configService.get<string>('APPLE_ROOT_CA_CERT_1'),
      this.configService.get<string>('APPLE_ROOT_CA_CERT_2'),
    ].filter(Boolean) as string[];

    this.appleRootCerts = rootCertPems.map(pem => new crypto.X509Certificate(pem));
  }

  async handleNotification(payload: AppleNotificationPayload): Promise<void> {
    try {
      const decodedPayload = await this.verifyAndDecodeSignedPayload(payload.signedPayload);
      const notificationType = decodedPayload.notificationType;
      const subtype = decodedPayload.subtype;
      const data: AppleNotificationData = decodedPayload.data;

      this.logger.log(`Apple notification received: ${notificationType}${subtype ? ` (${subtype})` : ''}`);

      // Verify bundle ID matches
      if (data.bundleId !== this.bundleId) {
        this.logger.warn(`Bundle ID mismatch: ${data.bundleId} !== ${this.bundleId}`);
        return;
      }

      // Decode transaction info
      const transactionInfo = await this.verifyAndDecodeJWS<AppleTransactionInfo>(
        data.signedTransactionInfo,
      );

      // Decode renewal info if present
      let renewalInfo: AppleRenewalInfo | null = null;
      if (data.signedRenewalInfo) {
        renewalInfo = await this.verifyAndDecodeJWS<AppleRenewalInfo>(
          data.signedRenewalInfo,
        );
      }

      // Handle different notification types
      switch (notificationType) {
        case 'SUBSCRIBED':
          await this.handleSubscribed(transactionInfo, renewalInfo);
          break;
        case 'DID_CHANGE_RENEWAL_PREF':
          await this.handleRenewalPreferenceChange(transactionInfo, renewalInfo);
          break;
        case 'DID_CHANGE_RENEWAL_STATUS':
          await this.handleRenewalStatusChange(transactionInfo, renewalInfo);
          break;
        case 'DID_FAIL_TO_RENEW':
          await this.handleFailedToRenew(transactionInfo, renewalInfo);
          break;
        case 'DID_RECOVER':
          await this.handleRecovered(transactionInfo, renewalInfo);
          break;
        case 'EXPIRED':
          await this.handleExpired(transactionInfo, renewalInfo);
          break;
        case 'REFUND':
          await this.handleRefund(transactionInfo, renewalInfo);
          break;
        case 'REFUND_DECLINED':
          await this.handleRefundDeclined(transactionInfo, renewalInfo);
          break;
        case 'CONSUMPTION_REQUEST':
          await this.handleConsumptionRequest(transactionInfo);
          break;
        case 'RENEWAL_EXTENDED':
          await this.handleRenewalExtended(transactionInfo, renewalInfo);
          break;
        case 'REVOKE':
          await this.handleRevoke(transactionInfo, renewalInfo);
          break;
        case 'TEST':
          this.logger.log('Apple test notification received');
          break;
        default:
          this.logger.warn(`Unknown notification type: ${notificationType}`);
      }
    } catch (error) {
      this.logger.error('Failed to handle Apple notification', error);
      throw error;
    }
  }

  private async verifyAndDecodeSignedPayload(signedPayload: string): Promise<any> {
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    const verified = await this.verifyJWSSignature(signedPayload, header);
    if (!verified) {
      throw new Error('JWS signature verification failed');
    }

    return payload;
  }

  private async verifyAndDecodeJWS<T>(signedJWS: string): Promise<T> {
    const parts = signedJWS.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format');
    }

    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    const verified = await this.verifyJWSSignature(signedJWS, header);
    if (!verified) {
      throw new Error('JWS signature verification failed');
    }

    return payload as T;
  }

  private async verifyJWSSignature(signedJWS: string, header: any): Promise<boolean> {
    try {
      if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
        throw new Error('Missing x5c certificate chain in JWS header');
      }

      // Build certificate chain from x5c
      const certs = header.x5c.map((cert: string) => {
        const pemHeader = '-----BEGIN CERTIFICATE-----\n';
        const pemFooter = '\n-----END CERTIFICATE-----';
        const pemBody = cert.match(/.{1,64}/g)?.join('\n') || cert;
        return `${pemHeader}${pemBody}${pemFooter}`;
      });

      // Parse certificates
      const leafCert = new crypto.X509Certificate(certs[0]);
      const intermediateCert = certs.length > 1 ? new crypto.X509Certificate(certs[1]) : null;

      // Verify certificate chain
      if (intermediateCert) {
        const verified = leafCert.checkIssued(intermediateCert);
        if (!verified) {
          this.logger.warn('Leaf certificate not issued by intermediate');
          return false;
        }
      }

      // Verify against Apple root CA
      let verifiedByRoot = false;
      for (const rootCert of this.appleRootCerts) {
        try {
          if (intermediateCert) {
            if (intermediateCert.checkIssued(rootCert)) {
              verifiedByRoot = true;
              break;
            }
          } else if (leafCert.checkIssued(rootCert)) {
            verifiedByRoot = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!verifiedByRoot) {
        this.logger.warn('Certificate chain not rooted in Apple CA');
        return false;
      }

      // Verify the signature using the leaf certificate's public key
      const [headerB64, payloadB64, signatureB64] = signedJWS.split('.');
      const signingInput = `${headerB64}.${payloadB64}`;
      const signature = Buffer.from(signatureB64, 'base64url');
      const publicKey = leafCert.publicKey;

      const verify = crypto.createVerify('SHA256');
      verify.update(signingInput);
      verify.end();

      return verify.verify(publicKey, signature);
    } catch (error) {
      this.logger.error('JWS signature verification failed', error);
      return false;
    }
  }

  private async handleSubscribed(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`User subscribed: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();
    const tier = PRODUCT_TIER_MAP[transactionInfo.productId] || 'consumer_8_ukp_10_usd';
    const expiresAt = new Date(transactionInfo.expiresDate).toISOString();

    // Store subscription record
    const { error: subError } = await supabase
      .from('apple_subscriptions')
      .upsert({
        original_transaction_id: transactionInfo.originalTransactionId,
        transaction_id: transactionInfo.transactionId,
        product_id: transactionInfo.productId,
        tier: tier,
        environment: transactionInfo.environment,
        purchase_date: new Date(transactionInfo.purchaseDate).toISOString(),
        expires_date: expiresAt,
        auto_renew_status: renewalInfo?.autoRenewStatus === 1,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'original_transaction_id' });

    if (subError) {
      this.logger.error('Failed to store subscription', subError);
      return;
    }

    // We need to find the user by their original transaction ID
    // This requires the user to have been linked during initial purchase
    // For now, we'll log and handle via the receipt validation flow
    this.logger.log(`Subscription stored for product: ${transactionInfo.productId}`);
  }

  private async handleRenewalPreferenceChange(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Renewal preference changed: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();
    const newProductId = renewalInfo?.autoRenewProductId;
    const newTier = newProductId ? PRODUCT_TIER_MAP[newProductId] : null;

    if (newTier) {
      const { error } = await supabase
        .from('apple_subscriptions')
        .update({
          product_id: newProductId,
          tier: newTier,
          updated_at: new Date().toISOString(),
        })
        .eq('original_transaction_id', transactionInfo.originalTransactionId);

      if (error) {
        this.logger.error('Failed to update subscription product', error);
      }
    }
  }

  private async handleRenewalStatusChange(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    const autoRenewStatus = renewalInfo?.autoRenewStatus === 1;
    this.logger.log(
      `Renewal status changed: ${transactionInfo.originalTransactionId} -> autoRenew: ${autoRenewStatus}`,
    );

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('apple_subscriptions')
      .update({
        auto_renew_status: autoRenewStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (error) {
      this.logger.error('Failed to update auto-renew status', error);
    }
  }

  private async handleFailedToRenew(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.warn(`Failed to renew: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('apple_subscriptions')
      .update({
        is_in_billing_retry: true,
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (error) {
      this.logger.error('Failed to update billing retry status', error);
    }
  }

  private async handleRecovered(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Subscription recovered: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();
    const expiresAt = new Date(transactionInfo.expiresDate).toISOString();

    const { error } = await supabase
      .from('apple_subscriptions')
      .update({
        is_active: true,
        is_in_billing_retry: false,
        expires_date: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (error) {
      this.logger.error('Failed to recover subscription', error);
    }
  }

  private async handleExpired(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Subscription expired: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();

    // Update subscription record
    const { error: subError } = await supabase
      .from('apple_subscriptions')
      .update({
        is_active: false,
        auto_renew_status: false,
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (subError) {
      this.logger.error('Failed to update expired subscription', subError);
    }

    // Find and downgrade the user
    const { data: subData } = await supabase
      .from('apple_subscriptions')
      .select('user_id')
      .eq('original_transaction_id', transactionInfo.originalTransactionId)
      .single();

    if (subData?.user_id) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_vip: false,
          vip_tier: 'free',
        })
        .eq('id', subData.user_id);

      if (userError) {
        this.logger.error('Failed to downgrade user', userError);
      }
    }
  }

  private async handleRefund(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Refund issued: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();

    // Update subscription record
    const { error: subError } = await supabase
      .from('apple_subscriptions')
      .update({
        is_active: false,
        is_refunded: true,
        refund_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (subError) {
      this.logger.error('Failed to update refunded subscription', subError);
    }

    // Find and downgrade the user
    const { data: subData } = await supabase
      .from('apple_subscriptions')
      .select('user_id')
      .eq('original_transaction_id', transactionInfo.originalTransactionId)
      .single();

    if (subData?.user_id) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_vip: false,
          vip_tier: 'free',
        })
        .eq('id', subData.user_id);

      if (userError) {
        this.logger.error('Failed to downgrade user after refund', userError);
      }
    }
  }

  private async handleRefundDeclined(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Refund declined: ${transactionInfo.originalTransactionId}`);
    // Log for analytics - no action needed
  }

  private async handleConsumptionRequest(
    transactionInfo: AppleTransactionInfo,
  ): Promise<void> {
    this.logger.log(`Consumption request: ${transactionInfo.originalTransactionId}`);
    // Apple requests consumption data for refund decisions
    // Return how much of the subscription was consumed
    // This would be implemented when we need to respond to Apple's request
  }

  private async handleRenewalExtended(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Renewal extended: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();
    const expiresAt = new Date(transactionInfo.expiresDate).toISOString();

    const { error } = await supabase
      .from('apple_subscriptions')
      .update({
        expires_date: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (error) {
      this.logger.error('Failed to update extended renewal', error);
    }
  }

  private async handleRevoke(
    transactionInfo: AppleTransactionInfo,
    renewalInfo: AppleRenewalInfo | null,
  ): Promise<void> {
    this.logger.log(`Subscription revoked: ${transactionInfo.originalTransactionId}`);
    
    const supabase = this.supabaseService.getClient();

    // Update subscription record
    const { error: subError } = await supabase
      .from('apple_subscriptions')
      .update({
        is_active: false,
        is_revoked: true,
        revoked_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('original_transaction_id', transactionInfo.originalTransactionId);

    if (subError) {
      this.logger.error('Failed to update revoked subscription', subError);
    }

    // Find and downgrade the user
    const { data: subData } = await supabase
      .from('apple_subscriptions')
      .select('user_id')
      .eq('original_transaction_id', transactionInfo.originalTransactionId)
      .single();

    if (subData?.user_id) {
      const { error: userError } = await supabase
        .from('users')
        .update({
          is_vip: false,
          vip_tier: 'free',
        })
        .eq('id', subData.user_id);

      if (userError) {
        this.logger.error('Failed to downgrade user after revoke', userError);
      }
    }
  }
}
