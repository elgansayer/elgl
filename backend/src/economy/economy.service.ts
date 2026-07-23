import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CentrifugoService } from '../chat/centrifugo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { PurchaseCoinsDto, SendGiftDto } from './dto/economy.dto';

export interface VirtualGiftRow {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
}

export interface UserCoinRow {
  id: string;
  coins_balance: number;
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  platform_product_id: {
    ios?: string;
    android?: string;
    web?: string;
  };
}

export interface VerifiedReceipt {
  valid: boolean;
  productId: string;
  transactionId: string;
  platform: 'ios' | 'android' | 'web';
}

export const COIN_PACKAGES: CoinPackage[] = [
  {
    id: 'coins_small',
    name: 'Small Coin Pack',
    coins: 100,
    price: 499,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.small',
      android: 'coins_small',
      web: 'coins_small_web',
    },
  },
  {
    id: 'coins_medium',
    name: 'Medium Coin Pack',
    coins: 500,
    price: 1999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.medium',
      android: 'coins_medium',
      web: 'coins_medium_web',
    },
  },
  {
    id: 'coins_large',
    name: 'Large Coin Pack',
    coins: 1200,
    price: 3999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.large',
      android: 'coins_large',
      web: 'coins_large_web',
    },
  },
  {
    id: 'coins_mega',
    name: 'Mega Coin Pack',
    coins: 3000,
    price: 7999,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.mega',
      android: 'coins_mega',
      web: 'coins_mega_web',
    },
  },
];

@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getCatalog(): Promise<VirtualGiftRow[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('virtual_gifts')
      .select('*')
      .order('cost_coins', { ascending: true });
    return (response.data ?? []) as VirtualGiftRow[];
  }

  async getPackages(): Promise<CoinPackage[]> {
    return COIN_PACKAGES;
  }

  async getBalance(userId: string): Promise<{ coins_balance: number }> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();
    if (!response.data) {
      return { coins_balance: 50 };
    }
    const row = response.data as UserCoinRow;
    return { coins_balance: row.coins_balance };
  }

  async purchaseCoins(
    userId: string,
    dto: PurchaseCoinsDto,
  ): Promise<{ coins: number; newBalance: number }> {
    // 1. Detect platform from receipt token if not provided
    const platform = dto.platform ?? this.detectPlatform(dto.receipt_token);

    // 2. Verify receipt with the appropriate store
    const verified = await this.verifyReceipt(dto.receipt_token, platform);

    if (!verified.valid) {
      throw new BadRequestException('Receipt verification failed');
    }

    // 3. Determine the coin package based on the product ID returned by the store
    const coinPackage = this.getCoinPackageByProductId(verified.productId);
    if (!coinPackage) {
      throw new BadRequestException(
        `Unknown product ID: ${verified.productId}`,
      );
    }

    // 4. Prevent duplicate transactions
    await this.checkDuplicateTransaction(verified.transactionId);

    // 5. Add coins to user balance
    const supabase = this.supabaseService.getClient();
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      throw new BadRequestException('User not found');
    }

    const currentBalance = user.coins_balance || 0;
    const newBalance = currentBalance + coinPackage.coins;

    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      throw new BadRequestException('Failed to update coin balance');
    }

    // 6. Log the purchase for audit
    await this.logPurchase(
      userId,
      coinPackage,
      dto.receipt_token,
      platform,
      verified.transactionId,
    );

    this.logger.log(
      `User ${userId} purchased ${coinPackage.coins} coins (product: ${verified.productId})`,
    );

    return {
      coins: coinPackage.coins,
      newBalance,
    };
  }

  private detectPlatform(receiptToken: string): 'ios' | 'android' | 'web' {
    if (receiptToken.startsWith('ios_')) return 'ios';
    if (receiptToken.startsWith('android_')) return 'android';
    return 'web';
  }

  private parseAndroidReceiptToken(
    receiptToken: string,
  ): { productId: string; purchaseToken: string } | null {
    // Expected format: android_{productId}_{purchaseToken}
    const parts = receiptToken.split('_');
    if (parts.length < 3 || parts[0] !== 'android') {
      return null;
    }
    // productId is the second part, purchaseToken is the rest (may contain underscores)
    const productId = parts[1];
    const purchaseToken = parts.slice(2).join('_');
    if (!productId || !purchaseToken) {
      return null;
    }
    return { productId, purchaseToken };
  }

  private async verifyReceipt(
    receiptToken: string,
    platform: string,
  ): Promise<VerifiedReceipt> {
    switch (platform) {
      case 'ios':
        return this.verifyAppleReceipt(receiptToken);
      case 'android':
        return this.verifyGooglePlayReceipt(receiptToken);
      default:
        return this.verifyStripeReceipt(receiptToken);
    }
  }

  private async verifyAppleReceipt(
    receiptToken: string,
  ): Promise<VerifiedReceipt> {
    const verificationUrl =
      this.configService.get<string>('APPLE_VERIFICATION_URL') ??
      'https://sandbox.itunes.apple.com/verifyReceipt';
    const sharedSecret = this.configService.get<string>('APPLE_SHARED_SECRET');

    if (!sharedSecret) {
      throw new BadRequestException('Apple shared secret not configured');
    }

    const response = await firstValueFrom(
      this.httpService.post(verificationUrl, {
        'receipt-data': receiptToken,
        password: sharedSecret,
        'exclude-old-transactions': true,
      }),
    );

    const body = response.data;

    if (body.status !== 0 && body.status !== 21007) {
      throw new BadRequestException(
        `Apple receipt verification failed (status: ${body.status})`,
      );
    }

    const latestReceiptInfo = body.latest_receipt_info?.[0];
    if (!latestReceiptInfo) {
      throw new BadRequestException('No purchase information in receipt');
    }

    return {
      valid: true,
      productId: latestReceiptInfo.product_id,
      transactionId: latestReceiptInfo.transaction_id,
      platform: 'ios',
    };
  }

  private async verifyGooglePlayReceipt(
    receiptToken: string,
  ): Promise<VerifiedReceipt> {
    const packageName = this.configService.get<string>(
      'GOOGLE_PLAY_PACKAGE_NAME',
    );
    const accessToken = this.configService.get<string>(
      'GOOGLE_PLAY_ACCESS_TOKEN',
    );

    if (!packageName || !accessToken) {
      throw new BadRequestException(
        'Google Play credentials not configured',
      );
    }

    // Expected format: android_{productId}_{purchaseToken}
    const parsed = this.parseAndroidReceiptToken(receiptToken);
    if (!parsed) {
      throw new BadRequestException('Invalid Android receipt token format');
    }

    const { productId, purchaseToken } = parsed;

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );

    const body = response.data;

    if (body.purchaseState !== 0) {
      throw new BadRequestException('Google Play purchase not completed');
    }

    return {
      valid: true,
      productId: body.productId,
      transactionId: body.orderId,
      platform: 'android',
    };
  }

  private async verifyStripeReceipt(
    receiptToken: string,
  ): Promise<VerifiedReceipt> {
    // For Stripe, the receipt token is the Stripe Checkout session ID
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('Stripe secret key not configured');
    }

    const sessionId = receiptToken.replace(/^stripe_/, '');

    const response = await firstValueFrom(
      this.httpService.get(
        `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${stripeSecretKey}`,
          },
        },
      ),
    );

    const session = response.data;

    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Stripe payment not completed');
    }

    const productId = session.metadata?.product_id;
    if (!productId) {
      throw new BadRequestException(
        'Stripe session metadata missing product_id',
      );
    }

    // Verify that the product ID matches one of our known packages
    const coinPackage = this.getCoinPackageByProductId(productId);
    if (!coinPackage) {
      throw new BadRequestException(
        `Unknown product ID in Stripe metadata: ${productId}`,
      );
    }

    return {
      valid: true,
      productId,
      transactionId: session.payment_intent,
      platform: 'web',
    };
  }

  private getCoinPackageByProductId(productId: string): CoinPackage | undefined {
    return COIN_PACKAGES.find(
      (pkg) =>
        pkg.platform_product_id.ios === productId ||
        pkg.platform_product_id.android === productId ||
        pkg.platform_product_id.web === productId,
    );
  }

  private async checkDuplicateTransaction(
    transactionId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: existing } = await supabase
      .from('coin_purchases')
      .select('id')
      .eq('transaction_id', transactionId)
      .single();

    if (existing) {
      throw new ForbiddenException(
        'This transaction has already been processed',
      );
    }
  }

  private async logPurchase(
    userId: string,
    coinPackage: CoinPackage,
    receiptToken: string,
    platform: string,
    transactionId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.from('coin_purchases').insert({
      user_id: userId,
      package_id: coinPackage.id,
      coins_added: coinPackage.coins,
      amount_paid: coinPackage.price,
      currency: 'usd',
      receipt_token: receiptToken,
      platform: platform || 'web',
      transaction_id: transactionId,
      status: 'completed',
    });

    if (error) {
      this.logger.error(
        `Failed to log purchase for user ${userId}: ${error.message}`,
      );
    }
  }

  async sendGift(
    senderId: string,
    dto: SendGiftDto,
  ): Promise<{
    success: boolean;
    coins_remaining: number;
    gift: VirtualGiftRow;
  }> {
    const supabase = this.supabaseService.getClient();

    const giftResponse = await supabase
      .from('virtual_gifts')
      .select('*')
      .eq('id', dto.gift_id)
      .single();
    if (!giftResponse.data) {
      throw new NotFoundException(
        `Gift '${dto.gift_id}' not found in catalog.`,
      );
    }
    const gift = giftResponse.data as VirtualGiftRow;

    const { coins_balance: senderBalance } = await this.getBalance(senderId);
    if (senderBalance < gift.cost_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${senderBalance} available, ${gift.cost_coins} required). Purchase coins to support your language partners and room hosts!`,
      );
    }

    const { coins_balance: receiverBalance } = await this.getBalance(
      dto.receiver_id,
    );

    // Deduct and credit
    const newSenderBalance = senderBalance - gift.cost_coins;
    const newReceiverBalance = receiverBalance + gift.cost_coins;

    await supabase
      .from('users')
      .update({ coins_balance: newSenderBalance })
      .eq('id', senderId);
    await supabase
      .from('users')
      .update({ coins_balance: newReceiverBalance })
      .eq('id', dto.receiver_id);

    await supabase.from('gift_transactions').insert({
      sender_id: senderId,
      receiver_id: dto.receiver_id,
      gift_id: gift.id,
      room_id: dto.room_id || null,
      coins_spent: gift.cost_coins,
    });

    const senderProfile = await this.usersService.getProfile(senderId);
    const receiverProfile = await this.usersService.getProfile(dto.receiver_id);

    const giftEvent = {
      type: 'virtual_gift',
      gift,
      sender_name: senderProfile?.display_name ?? 'Language Partner',
      receiver_name: receiverProfile?.display_name ?? 'Room Host',
      room_id: dto.room_id,
    };

    if (dto.room_id) {
      void this.centrifugoService.publish(`room_${dto.room_id}`, giftEvent);
    } else {
      void this.centrifugoService.publish(`user_${dto.receiver_id}`, giftEvent);
    }

    return {
      success: true,
      coins_remaining: newSenderBalance,
      gift,
    };
  }
}
