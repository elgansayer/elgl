import { Injectable, Inject, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../supabase/supabase.service';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidationResponse } from './dto/monetisation.dto';

interface AppleReceiptResponse {
  environment: 'Sandbox' | 'Production';
  isRetryable: boolean;
  latestReceiptInfo: AppleReceiptInfo[];
  latestReceipt: string;
  pendingRenewalInfo: ApplePendingRenewalInfo[];
  status: number;
}

interface AppleReceiptInfo {
  quantity: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  purchaseDateMs: string;
  originalPurchaseDate: string;
  originalPurchaseDateMs: string;
  expiresDate: string;
  expiresDateMs: string;
  isTrialPeriod: string;
  isInIntroOfferPeriod: string;
  webOrderLineItemId: string;
  bundleId: string;
  inAppOwnershipType: string;
}

interface ApplePendingRenewalInfo {
  autoRenewProductId: string;
  autoRenewStatus: string;
  expirationIntent: string;
  isInBillingRetryPeriod: string;
  originalTransactionId: string;
  productId: string;
}

const PRODUCT_TIER_MAP: Record<string, string> = {
  'com.hellotalk.vip.monthly': 'consumer_8_ukp_10_usd',
  'com.hellotalk.vip.yearly': 'consumer_8_ukp_10_usd',
  'com.hellotalk.developer.monthly': 'developer_20_ukp_26_usd',
  'com.hellotalk.developer.yearly': 'developer_20_ukp_26_usd',
};

@Injectable()
export class AppleReceiptValidatorService {
  private readonly logger = new Logger(AppleReceiptValidatorService.name);
  private readonly productionUrl = 'https://buy.itunes.apple.com/verifyReceipt';
  private readonly sandboxUrl =
    'https://sandbox.itunes.apple.com/verifyReceipt';
  private readonly sharedSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => MonetisationService))
    private readonly monetisationService: MonetisationService,
  ) {
    this.sharedSecret =
      this.configService.get<string>('APPLE_SHARED_SECRET') || '';
  }

  async validateReceipt(
    userId: string,
    receiptData: string,
    excludeOldTransactions: boolean = true,
  ): Promise<AppleReceiptValidationResponse> {
    // First try production
    try {
      const result = await this.verifyWithUrl(
        this.productionUrl,
        receiptData,
        excludeOldTransactions,
      );

      // If status is 21007, it's a sandbox receipt
      if (result.status === 21007) {
        this.logger.log('Receipt is from sandbox environment, retrying...');
        const sandboxResult = await this.verifyWithUrl(
          this.sandboxUrl,
          receiptData,
          excludeOldTransactions,
        );
        return this.processValidationResult(userId, sandboxResult);
      }

      return this.processValidationResult(userId, result);
    } catch (error) {
      this.logger.error('Receipt validation failed', error);
      throw error;
    }
  }

  private async verifyWithUrl(
    url: string,
    receiptData: string,
    excludeOldTransactions: boolean,
  ): Promise<AppleReceiptResponse> {
    const response = await firstValueFrom(
      this.httpService.post<AppleReceiptResponse>(url, {
        'receipt-data': receiptData,
        password: this.sharedSecret,
        'exclude-old-transactions': excludeOldTransactions,
      }),
    );

    const result = response.data;

    switch (result.status) {
      case 0:
        return result;
      case 21000:
        throw new Error(
          'The App Store could not read the JSON object you provided.',
        );
      case 21002:
        throw new Error('The data in the receipt-data property was malformed.');
      case 21003:
        throw new Error('The receipt could not be authenticated.');
      case 21004:
        throw new Error(
          'The shared secret you provided does not match the shared secret on file.',
        );
      case 21005:
        throw new Error('The receipt server is not currently available.');
      case 21006:
        return result; // Valid but expired
      case 21007:
        return result; // Sandbox receipt sent to production
      case 21008:
        throw new Error('This receipt is from the production environment.');
      case 21009:
        throw new Error('Internal data access error.');
      case 21010:
        throw new Error(
          'The user account cannot be found or has been deleted.',
        );
      default:
        throw new Error(`Unknown status code: ${result.status}`);
    }
  }

  private async processValidationResult(
    userId: string,
    result: AppleReceiptResponse,
  ): Promise<AppleReceiptValidationResponse> {
    const supabase = this.supabaseService.getClient();

    // Get the latest receipt info
    const latestInfo = result.latestReceiptInfo?.[0];
    if (!latestInfo) {
      return { valid: false };
    }

    const productId = latestInfo.productId;
    const tier = PRODUCT_TIER_MAP[productId] || 'consumer_8_ukp_10_usd';
    const expiresDate = latestInfo.expiresDate
      ? new Date(parseInt(latestInfo.expiresDateMs)).toISOString()
      : null;
    const isActive =
      result.status === 0 && expiresDate
        ? new Date(expiresDate) > new Date()
        : false;

    // Store subscription record
    const { error: subError } = await supabase
      .from('apple_subscriptions')
      .upsert(
        {
          user_id: userId,
          original_transaction_id: latestInfo.originalTransactionId,
          transaction_id: latestInfo.transactionId,
          product_id: productId,
          tier: tier,
          environment: result.environment,
          purchase_date: new Date(
            parseInt(latestInfo.purchaseDateMs),
          ).toISOString(),
          expires_date: expiresDate,
          auto_renew_status:
            result.pendingRenewalInfo?.[0]?.autoRenewStatus === '1',
          is_active: isActive,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'original_transaction_id' },
      );

    if (subError) {
      this.logger.error('Failed to store subscription', subError);
    }

    // Update user VIP status via webhook-only path
    if (isActive) {
      await this.monetisationService.updateVipStatusFromWebhook(
        userId,
        true,
        tier,
      );
    }

    return {
      valid: isActive,
      product_id: productId,
      expiration_date: expiresDate || undefined,
    };
  }
}
