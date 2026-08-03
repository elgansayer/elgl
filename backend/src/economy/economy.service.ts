import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import Stripe from 'stripe';
import { CentrifugoService } from '../chat/centrifugo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import {
  PurchaseCoinsDto,
  SendGiftDto,
  UnlockStickerPackDto,
} from './dto/economy.dto';

export interface VirtualGiftRow {
  id: string;
  name: string;
  icon: string;
  cost_coins: number;
  animation_type: string;
  animation_url?: string;
}

export interface StickerPackRow {
  id: string;
  name: string;
  cost_coins: number;
}

export interface UserCoinRow {
  id: string;
  coins_balance: number;
}

export interface CoinPurchaseRecord {
  id: string;
  user_id: string;
  package_id: string;
  coins_added: number;
  amount_paid: number;
  currency: string;
  receipt_token: string;
  platform: string;
  transaction_id: string | null;
  status: string;
}

function isCoinPurchaseRecord(value: unknown): value is CoinPurchaseRecord {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    !('user_id' in value) ||
    !('package_id' in value) ||
    !('coins_added' in value) ||
    !('amount_paid' in value) ||
    !('currency' in value) ||
    !('receipt_token' in value) ||
    !('platform' in value) ||
    !('transaction_id' in value) ||
    !('status' in value)
  )
    return false;
  return (
    typeof value.id === 'string' &&
    typeof value.user_id === 'string' &&
    typeof value.package_id === 'string' &&
    typeof value.coins_added === 'number' &&
    typeof value.amount_paid === 'number' &&
    typeof value.currency === 'string' &&
    typeof value.receipt_token === 'string' &&
    typeof value.platform === 'string' &&
    (typeof value.transaction_id === 'string' ||
      value.transaction_id === null) &&
    typeof value.status === 'string'
  );
}

export interface CoinPackage {
  id: string;
  name: string;
  coins: number;
  price: number;
  price_ukp: number;
  price_usd: number;
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
    price_ukp: 4,
    price_usd: 4.99,
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
    price_ukp: 16,
    price_usd: 19.99,
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
    price_ukp: 32,
    price_usd: 39.99,
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
    price_ukp: 64,
    price_usd: 79.99,
    platform_product_id: {
      ios: 'com.linguaexchange.coins.mega',
      android: 'coins_mega',
      web: 'coins_mega_web',
    },
  },
];

function isCoinBalanceRow(value: unknown): value is { coins_balance: number } {
  if (typeof value !== 'object' || value === null) return false;
  if (!('coins_balance' in value)) return false;
  return typeof value.coins_balance === 'number';
}

function isVirtualGiftRow(value: unknown): value is VirtualGiftRow {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    !('name' in value) ||
    !('icon' in value) ||
    !('cost_coins' in value) ||
    !('animation_type' in value)
  )
    return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.icon === 'string' &&
    typeof value.cost_coins === 'number' &&
    typeof value.animation_type === 'string'
  );
}

function isStickerPackRow(value: unknown): value is StickerPackRow {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value) || !('name' in value) || !('cost_coins' in value))
    return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.cost_coins === 'number'
  );
}

export interface GiftEventPayload {
  type: 'virtual_gift';
  gift_id: string;
  gift_name: string;
  icon: string;
  animation_url: string;
  animation_type: string;
  coin_value: number;
  sender_name: string | null;
  receiver_name: string | null;
  room_id?: string;
}

@Injectable()
export class EconomyService {
  private readonly logger = new Logger(EconomyService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2023-10-16',
      },
    );
  }

  async getCatalog(): Promise<VirtualGiftRow[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('virtual_gifts')
      .select('*')
      .order('cost_coins', { ascending: true });
    const rows = response.data;
    if (!Array.isArray(rows)) {
      return this.getDefaultGiftCatalog();
    }
    const gifts = rows.filter(
      (item: unknown): item is VirtualGiftRow =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'name' in item &&
        'icon' in item &&
        'cost_coins' in item &&
        'animation_type' in item,
    );
    if (gifts.length === 0) {
      return this.getDefaultGiftCatalog();
    }
    return gifts;
  }

  private getDefaultGiftCatalog(): VirtualGiftRow[] {
    return [
      {
        id: 'gift_rose',
        name: 'Rose',
        icon: '🌹',
        cost_coins: 10,
        animation_type: 'float',
        animation_url: 'https://r2.example.com/rose.json',
      },
      {
        id: 'gift_heart',
        name: 'Heart',
        icon: '❤️',
        cost_coins: 20,
        animation_type: 'float',
        animation_url: 'https://r2.example.com/heart.json',
      },
    ];
  }

  getPackages(): CoinPackage[] {
    return COIN_PACKAGES;
  }

  /**
   * Starts a real Stripe Checkout session for a coin package. The balance is
   * never credited here: `purchaseCoins` re-verifies the resulting session
   * with Stripe's API once the client returns with the session ID as a
   * receipt token, so a client can never grant itself coins by lying about
   * payment success.
   */
  async createCheckoutSession(
    userId: string,
    packageId: string,
  ): Promise<{ sessionUrl: string; sessionId: string }> {
    const coinPackage = COIN_PACKAGES.find((pkg) => pkg.id === packageId);
    if (!coinPackage) {
      throw new NotFoundException(`Coin package "${packageId}" not found`);
    }

    const productId = coinPackage.platform_product_id.web;
    if (!productId) {
      throw new BadRequestException(
        `Coin package "${packageId}" is not available for web purchase`,
      );
    }

    const supabase = this.supabaseService.getClient();

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: coinPackage.name },
            unit_amount: coinPackage.price,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        product_id: productId,
      },
      success_url: `${frontendUrl}/coins/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/coins/cancel`,
    });

    const { error: insertPendingError } = await supabase
      .from('coin_purchases')
      .insert({
        user_id: userId,
        package_id: coinPackage.id,
        coins_added: coinPackage.coins,
        amount_paid: coinPackage.price,
        currency: 'usd',
        receipt_token: session.id,
        platform: 'web',
        transaction_id: session.id,
        status: 'pending',
      });

    if (insertPendingError) {
      this.logger.error(
        `Failed to create pending purchase record for user ${userId}: ${insertPendingError.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to initialize purchase session.',
      );
    }

    return {
      sessionUrl: session.url || '',
      sessionId: session.id,
    };
  }

  async getBalance(userId: string): Promise<{ coins_balance: number }> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();
    if (response.error || !response.data) {
      const profile = await this.usersService.getProfile(userId);
      return { coins_balance: profile.coins_balance ?? 50 };
    }
    const row = response.data;
    if (!isCoinBalanceRow(row)) {
      throw new BadRequestException('Invalid user coin balance');
    }
    return { coins_balance: row.coins_balance };
  }

  async claimDailyCheckIn(userId: string): Promise<{
    claimed: boolean;
    coins_rewarded: number;
    new_balance: number;
  }> {
    const redis = this.supabaseService.getRedisClient();
    const today = new Date().toISOString().slice(0, 10);
    const key = `daily_checkin:${userId}:${today}`;

    const alreadyClaimed = await redis.get(key);
    if (alreadyClaimed) {
      const { coins_balance } = await this.getBalance(userId);
      return { claimed: false, coins_rewarded: 0, new_balance: coins_balance };
    }

    // Grant between 5 and 10 coins
    const reward = Math.floor(Math.random() * 6) + 5;
    const { coins_balance } = await this.getBalance(userId);
    const newBalance = coins_balance + reward;

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(
        'Failed to update coin balance for daily check-in',
      );
    }

    // Set key to expire in 24 hours
    await redis.set(key, '1', 'EX', 86400);

    this.logger.log(
      `User ${userId} claimed daily check-in reward of ${reward} coins.`,
    );

    return { claimed: true, coins_rewarded: reward, new_balance: newBalance };
  }

  async verifyPurchaseReceipt(dto: {
    receipt_token: string;
    platform: string;
  }): Promise<boolean> {
    // Implement server-side receipt verification logic here
    // This is a placeholder implementation
    const isValid = true; // Replace with actual verification logic
    return isValid;
  }

  async purchaseCoins(
    userId: string,
    dto: PurchaseCoinsDto,
  ): Promise<{ coins: number; new_balance: number }> {
    const supabase = this.supabaseService.getClient();

    const platform = this.detectPlatform(dto.receipt_token);

    if (dto.platform && dto.platform !== platform) {
      throw new BadRequestException(
        `Receipt platform (${platform}) does not match provided platform (${dto.platform})`,
      );
    }

    const isReceiptValid = await this.verifyPurchaseReceipt({
      receipt_token: dto.receipt_token,
      platform,
    });

    if (!isReceiptValid) {
      throw new BadRequestException('Invalid purchase receipt');
    }

    // For web (Stripe) ensure a pending purchase record was created server-side
    if (platform === 'web') {
      const sessionId = this.extractStripeSessionId(dto.receipt_token);
      const { data: pendingRecord, error: pendingError } = await supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('receipt_token', sessionId)
        .maybeSingle();

      if (pendingError) {
        throw new InternalServerErrorException(
          'Failed to look up purchase record',
        );
      }

      if (!pendingRecord || !isCoinPurchaseRecord(pendingRecord)) {
        throw new BadRequestException(
          'No purchase receipt record found for this transaction. Please start a checkout session first.',
        );
      }

      if (pendingRecord.status === 'completed') {
        throw new ConflictException(
          'This transaction has already been processed',
        );
      }

      if (pendingRecord.status !== 'pending') {
        throw new BadRequestException('Invalid purchase receipt status');
      }
    }

    // 1. Verify with the store/provider
    const verifiedReceipt = await this.verifyReceipt(
      dto.receipt_token,
      platform,
      userId,
    );

    if (!verifiedReceipt.valid) {
      throw new BadRequestException('Receipt verification failed');
    }

    const { productId, transactionId } = verifiedReceipt;

    // 2. Find corresponding coin package (coins amount is derived server-side)
    const coinPackage = COIN_PACKAGES.find(
      (pkg) =>
        pkg.platform_product_id.ios === productId ||
        pkg.platform_product_id.android === productId ||
        pkg.platform_product_id.web === productId,
    );
    if (!coinPackage) {
      throw new BadRequestException(`Unknown product ID: ${productId}.`);
    }

    if (platform === 'web') {
      // Update the existing pending record to completed
      const sessionId = this.extractStripeSessionId(dto.receipt_token);
      const { data: existingWeb, error: existingWebError } = await supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('receipt_token', sessionId)
        .maybeSingle();

      if (existingWebError) {
        throw new InternalServerErrorException(
          'Failed to look up purchase record',
        );
      }

      if (!existingWeb || !isCoinPurchaseRecord(existingWeb)) {
        throw new BadRequestException('Purchase record not found');
      }

      if (existingWeb.status === 'completed') {
        throw new ConflictException(
          'This transaction has already been processed',
        );
      }

      const { error: updateWebError } = await supabase
        .from('coin_purchases')
        .update({
          status: 'completed',
          transaction_id: transactionId || sessionId,
        })
        .eq('user_id', userId)
        .eq('receipt_token', sessionId);

      if (updateWebError) {
        this.logger.error(
          `Failed to finalize purchase record for user ${userId}: ${updateWebError.message}`,
        );
        throw new InternalServerErrorException(
          'Failed to finalize purchase record',
        );
      }
    } else {
      // ios / android flow: insert a new completed record
      const { data: existing } = await supabase
        .from('coin_purchases')
        .select('id')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      if (existing) {
        throw new ConflictException(
          'This transaction has already been processed',
        );
      }

      const { error: insertError } = await supabase
        .from('coin_purchases')
        .insert({
          user_id: userId,
          package_id: coinPackage.id,
          coins_added: coinPackage.coins,
          amount_paid: coinPackage.price,
          currency: 'usd',
          receipt_token: dto.receipt_token,
          platform,
          transaction_id: transactionId,
          status: 'completed',
        });

      if (insertError) {
        if (insertError.code === '23505') {
          throw new ConflictException(
            'This transaction has already been processed',
          );
        }
        this.logger.error(
          `Failed to record coin purchase for user ${userId}: ${insertError.message}`,
        );
        throw new InternalServerErrorException('Failed to record purchase');
      }
    }

    // Read current balance and credit coins
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      // For non-web platforms roll back the purchase record; for web the record
      // is already finalised but we log and return a helpful error.
      if (platform !== 'web') {
        await supabase
          .from('coin_purchases')
          .delete()
          .eq('transaction_id', transactionId);
      }
      this.logger.error(
        `Failed to retrieve user balance during purchase for ${userId}.`,
      );
      throw new BadRequestException('User not found');
    }

    const currentBalance =
      typeof userData.coins_balance === 'number' ? userData.coins_balance : 0;
    const newBalance = currentBalance + coinPackage.coins;

    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      if (platform !== 'web') {
        await supabase
          .from('coin_purchases')
          .delete()
          .eq('transaction_id', transactionId);
      }
      this.logger.error(
        `Failed to credit coin balance for user ${userId}: ${updateError.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to credit coin balance.  Your payment was recorded; please contact support.',
      );
    }

    this.logger.log(
      `User ${userId} received ${coinPackage.coins} coins (transaction ${transactionId})`,
    );

    return {
      coins: coinPackage.coins,
      new_balance: newBalance,
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

  private extractStripeSessionId(receiptToken: string): string {
    return receiptToken.replace(/^stripe_/, '');
  }

  private async verifyReceipt(
    receiptToken: string,
    platform: string,
    userId: string,
  ): Promise<VerifiedReceipt> {
    switch (platform) {
      case 'ios':
        return this.verifyAppleReceipt(receiptToken);
      case 'android':
        return this.verifyGooglePlayReceipt(receiptToken);
      default:
        return this.verifyStripeReceipt(receiptToken, userId);
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

    const body = response.data as {
      status: number;
      latest_receipt_info?: Array<{
        product_id: string;
        transaction_id: string;
      }>;
    };
    if (!body) {
      throw new BadRequestException('Invalid Apple receipt response');
    }

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
      throw new BadRequestException('Google Play credentials not configured');
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

    const body = response.data as {
      purchaseState: number;
      productId: string;
      orderId: string;
    };
    if (!body) {
      throw new BadRequestException('Invalid Google Play response');
    }

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
    userId: string,
  ): Promise<VerifiedReceipt> {
    // For Stripe, the receipt token is the Stripe Checkout session ID
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      throw new BadRequestException('Stripe secret key not configured');
    }

    const sessionId = receiptToken.replace(/^stripe_/, '');

    if (!sessionId) {
      throw new BadRequestException('Invalid Stripe receipt token');
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected error';
      this.logger.warn(`Stripe session retrieve failed: ${errorMessage}`);
      throw new BadRequestException('Invalid Stripe session ID');
    }

    if (session.payment_status !== 'paid') {
      throw new BadRequestException('Stripe payment not completed');
    }

    if (session.metadata?.userId !== userId) {
      throw new BadRequestException(
        'This Stripe checkout session does not belong to the requesting user',
      );
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

    // Ensure the paid amount matches the package price to prevent partial payments
    if (session.amount_total !== coinPackage.price) {
      throw new BadRequestException(
        'Stripe payment amount does not match the coin package price',
      );
    }

    return {
      valid: true,
      productId,
      transactionId: session.id,
      platform: 'web',
    };
  }

  private getCoinPackageByProductId(
    productId: string,
  ): CoinPackage | undefined {
    return COIN_PACKAGES.find(
      (pkg) =>
        pkg.platform_product_id.ios === productId ||
        pkg.platform_product_id.android === productId ||
        pkg.platform_product_id.web === productId,
    );
  }

  async sendGift(
    senderId: string,
    dto: SendGiftDto,
  ): Promise<{
    success: boolean;
    coins_remaining: number;
    gift: VirtualGiftRow;
  }> {
    if (senderId === dto.receiver_id) {
      throw new BadRequestException('You cannot send a gift to yourself');
    }

    const supabase = this.supabaseService.getClient();

    const giftResponse = await supabase
      .from('virtual_gifts')
      .select('*')
      .eq('id', dto.gift_id)
      .maybeSingle();
    if (giftResponse.error || !giftResponse.data) {
      throw new NotFoundException(
        `Gift '${dto.gift_id}' not found in catalog.`,
      );
    }
    const giftData = giftResponse.data;
    if (!isVirtualGiftRow(giftData)) {
      throw new NotFoundException(
        `Gift '${dto.gift_id}' not found in catalog.`,
      );
    }
    const gift = giftData;

    const { coins_balance: senderBalance } = await this.getBalance(senderId);
    if (senderBalance < gift.cost_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${senderBalance} available, ${
          gift.cost_coins
        } required). Purchase coins to support your language partners and room hosts!`,
      );
    }

    // Verify the receiver exists before crediting coins
    const receiverCheck = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.receiver_id)
      .maybeSingle();
    if (receiverCheck.error || !receiverCheck.data) {
      throw new NotFoundException('Receiver user not found.');
    }

    const { coins_balance: receiverBalance } = await this.getBalance(
      dto.receiver_id,
    );

    // Deduct and credit
    const newSenderBalance = senderBalance - gift.cost_coins;
    const newReceiverBalance = receiverBalance + gift.cost_coins;

    const { error: senderUpdateError } = await supabase
      .from('users')
      .update({ coins_balance: newSenderBalance })
      .eq('id', senderId);

    if (senderUpdateError) {
      throw new InternalServerErrorException(
        'Failed to update sender coin balance.',
      );
    }

    const { error: receiverUpdateError } = await supabase
      .from('users')
      .update({ coins_balance: newReceiverBalance })
      .eq('id', dto.receiver_id);

    if (receiverUpdateError) {
      // Roll back sender's balance
      await supabase
        .from('users')
        .update({ coins_balance: senderBalance })
        .eq('id', senderId);
      throw new InternalServerErrorException(
        'Failed to credit receiver coin balance.',
      );
    }

    const { error: insertError } = await supabase
      .from('gift_transactions')
      .insert({
        sender_id: senderId,
        receiver_id: dto.receiver_id,
        gift_id: gift.id,
        room_id: dto.room_id || null,
        coins_spent: gift.cost_coins,
      });

    if (insertError) {
      // Rollback both balances
      await supabase
        .from('users')
        .update({ coins_balance: senderBalance })
        .eq('id', senderId);
      await supabase
        .from('users')
        .update({ coins_balance: receiverBalance })
        .eq('id', dto.receiver_id);
      throw new InternalServerErrorException(
        'Failed to record gift transaction.',
      );
    }

    const senderProfile = await this.usersService.getProfile(senderId);
    const receiverProfile = await this.usersService.getProfile(dto.receiver_id);

    const giftEvent: GiftEventPayload = {
      type: 'virtual_gift',
      gift_id: gift.id,
      gift_name: gift.name,
      icon: gift.icon,
      animation_url: gift.animation_url ?? '',
      animation_type: gift.animation_type,
      coin_value: gift.cost_coins,
      sender_name: senderProfile?.display_name ?? null,
      receiver_name: receiverProfile?.display_name ?? null,
      room_id: dto.room_id,
    };

    // Broadcast the animated gift to the recipient's user channel
    // and, when applicable, the room channel for the live feed.
    void this.centrifugoService.publish(`user_${dto.receiver_id}`, giftEvent);
    if (dto.room_id) {
      void this.centrifugoService.publish(`room_${dto.room_id}`, giftEvent);
    }

    return {
      success: true,
      coins_remaining: newSenderBalance,
      gift,
    };
  }

  async unlockStickerPack(
    userId: string,
    dto: UnlockStickerPackDto,
  ): Promise<{
    success: boolean;
    coins_remaining: number;
    pack: StickerPackRow;
  }> {
    const supabase = this.supabaseService.getClient();

    // 1. Fetch the sticker pack details
    const packResponse = await supabase
      .from('sticker_packs')
      .select('*')
      .eq('id', dto.pack_id)
      .single();

    if (!packResponse.data) {
      throw new NotFoundException(`Sticker pack '${dto.pack_id}' not found.`);
    }
    const packData = packResponse.data;
    if (!isStickerPackRow(packData)) {
      throw new NotFoundException(`Sticker pack '${dto.pack_id}' not found.`);
    }
    const pack = packData;

    // 2. Check user's coin balance
    const { coins_balance } = await this.getBalance(userId);
    if (coins_balance < pack.cost_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${coins_balance} available, ${pack.cost_coins} required).`,
      );
    }

    // 3. Deduct coins
    const newBalance = coins_balance - pack.cost_coins;
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      throw new InternalServerErrorException('Failed to deduct coins');
    }

    // 4. Record ownership
    const { error: insertError } = await supabase
      .from('user_sticker_packs')
      .insert({
        user_id: userId,
        pack_id: pack.id,
      });

    if (insertError) {
      // Note: In a robust system, you'd want to rollback the coin deduction here
      this.logger.error(
        `Failed to record sticker pack ownership for user ${userId}: ${insertError.message}`,
      );
    }

    return {
      success: true,
      coins_remaining: newBalance,
      pack,
    };
  }
}
