import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { firstValueFrom } from 'rxjs';
import Stripe from 'stripe';
import { CentrifugoService } from '../chat/centrifugo.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import { MetricsService } from '../metrics/metrics.service';
import {
  PurchaseCoinsDto,
  SendGiftDto,
  UnlockStickerPackDto,
} from './dto/economy.dto';
import { sanitiseEconomyData } from './sanitise-economy.helper';
import { withExponentialBackoff } from '../common/http-retry.helper';

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
  is_animated?: boolean | null;
  sticker_urls?: string[] | null;
  animation_url?: string | null;
}

interface StickerUnlockRpcRow {
  success: boolean;
  newly_unlocked: boolean;
  coins_remaining: number;
  pack_id: string;
  pack_name: string;
  pack_cost_coins: number;
  pack_is_animated: boolean | null;
  pack_sticker_urls: string[] | null;
  pack_animation_url: string | null;
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

function isStickerUnlockRpcRow(value: unknown): value is StickerUnlockRpcRow {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('success' in value) ||
    !('newly_unlocked' in value) ||
    !('coins_remaining' in value) ||
    !('pack_id' in value) ||
    !('pack_name' in value) ||
    !('pack_cost_coins' in value) ||
    !('pack_is_animated' in value) ||
    !('pack_sticker_urls' in value) ||
    !('pack_animation_url' in value)
  )
    return false;

  const stickerUrls = value.pack_sticker_urls;
  return (
    typeof value.success === 'boolean' &&
    typeof value.newly_unlocked === 'boolean' &&
    typeof value.coins_remaining === 'number' &&
    typeof value.pack_id === 'string' &&
    typeof value.pack_name === 'string' &&
    typeof value.pack_cost_coins === 'number' &&
    (typeof value.pack_is_animated === 'boolean' ||
      value.pack_is_animated === null) &&
    (stickerUrls === null ||
      (Array.isArray(stickerUrls) &&
        stickerUrls.every((url) => typeof url === 'string'))) &&
    (typeof value.pack_animation_url === 'string' ||
      value.pack_animation_url === null)
  );
}

export interface CoinTransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GiftEventPayload {
  [key: string]: unknown;
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
  private readonly stripe: Stripe;

  constructor(
    @InjectPinoLogger(EconomyService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
    private readonly centrifugoService: CentrifugoService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {
    let stripeSecret = this.configService.get<string>('STRIPE_SECRET_KEY');
    const env = this.configService.get<string>('NODE_ENV') || 'development';

    if (env === 'production') {
      if (
        !stripeSecret ||
        stripeSecret === 'sk_test_123' ||
        stripeSecret === 'sk_test'
      ) {
        throw new Error(
          'STRIPE_SECRET_KEY must be configured securely in production',
        );
      }
    } else {
      if (!stripeSecret) {
        stripeSecret = 'sk_test_123';
      }
    }

    this.stripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    });
  }

  private static readonly CATALOG_CACHE_KEY = 'economy:catalog';
  private static readonly CATALOG_CACHE_TTL = 3600;
  private static readonly STICKER_PACKS_CACHE_PREFIX = 'economy:sticker_packs:';
  private static readonly STICKER_PACKS_CACHE_TTL = 300;

  async getCatalog(): Promise<VirtualGiftRow[]> {
    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(EconomyService.CATALOG_CACHE_KEY);
      if (cached) {
        try {
          const parsed: unknown = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as VirtualGiftRow[];
          }
        } catch {
          this.logger.warn(
            'Invalid economy catalog cache entry, falling back to DB',
          );
        }
      }
    } catch (redisError: unknown) {
      this.logger.warn(
        `Redis unavailable for catalog cache: ${redisError instanceof Error ? redisError.message : 'unknown error'}, falling back to DB`,
      );
    }

    let gifts: VirtualGiftRow[];
    try {
      const supabase = this.supabaseService.getClient();
      const response = await withExponentialBackoff(
        () =>
          supabase
            .from('virtual_gifts')
            .select('*')
            .order('cost_coins', { ascending: true }),
        'getCatalog',
        { logger: this.logger },
      );
      const rows = response.data;
      if (!Array.isArray(rows)) {
        gifts = this.getDefaultGiftCatalog();
      } else {
        const filtered = rows.filter(
          (item: unknown): item is VirtualGiftRow =>
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            'name' in item &&
            'icon' in item &&
            'cost_coins' in item &&
            'animation_type' in item,
        );
        gifts = filtered.length > 0 ? filtered : this.getDefaultGiftCatalog();
      }
    } catch (dbError: unknown) {
      this.logger.warn(
        `Database unavailable for catalog query: ${dbError instanceof Error ? dbError.message : 'unknown error'}, using default catalog`,
      );
      gifts = this.getDefaultGiftCatalog();
    }

    const sanitised = sanitiseEconomyData(gifts);

    try {
      const redis = this.supabaseService.getRedisClient();
      redis
        .set(
          EconomyService.CATALOG_CACHE_KEY,
          JSON.stringify(sanitised),
          'EX',
          EconomyService.CATALOG_CACHE_TTL,
        )
        .catch(() => {
          // Redis write failure is non-critical; catalog already returned
        });
    } catch {
      // Redis client access failure is non-critical
    }

    return sanitised;
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

    const { error: insertPendingError } = await withExponentialBackoff(
      () =>
        supabase.from('coin_purchases').insert({
          user_id: userId,
          package_id: coinPackage.id,
          coins_added: coinPackage.coins,
          amount_paid: coinPackage.price,
          currency: 'usd',
          receipt_token: session.id,
          platform: 'web',
          transaction_id: session.id,
          status: 'pending',
        }),
      'createCheckoutSession',
      { logger: this.logger },
    );

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
    try {
      const supabase = this.supabaseService.getClient();
      const response = await withExponentialBackoff(
        () =>
          supabase
            .from('users')
            .select('coins_balance')
            .eq('id', userId)
            .single(),
        'getBalance',
        { logger: this.logger },
      );
      if (response.error || !response.data) {
        try {
          const profile = await this.usersService.getProfile(userId);
          return { coins_balance: profile.coins_balance ?? 50 };
        } catch (profileError: unknown) {
          this.logger.warn(
            `Profile lookup failed for user ${userId}: ${profileError instanceof Error ? profileError.message : 'unknown error'}, returning default balance`,
          );
          return { coins_balance: 50 };
        }
      }
      const row = response.data;
      if (!isCoinBalanceRow(row)) {
        this.logger.warn(
          `Invalid coin balance row for user ${userId}, returning default balance`,
        );
        return { coins_balance: 50 };
      }
      return { coins_balance: row.coins_balance };
    } catch (dbError: unknown) {
      this.logger.warn(
        `Database unavailable for balance lookup: ${dbError instanceof Error ? dbError.message : 'unknown error'}, trying profile fallback`,
      );
      try {
        const profile = await this.usersService.getProfile(userId);
        return { coins_balance: profile.coins_balance ?? 50 };
      } catch {
        return { coins_balance: 50 };
      }
    }
  }

  async claimDailyCheckIn(userId: string): Promise<{
    claimed: boolean;
    coins_rewarded: number;
    new_balance: number;
  }> {
    const startTime = Date.now();
    const redis = this.supabaseService.getRedisClient();
    const today = new Date().toISOString().slice(0, 10);
    const key = `daily_checkin:${userId}:${today}`;

    // Graceful: Redis unavailable means we proceed as not-yet-claimed
    let alreadyClaimed = false;
    try {
      alreadyClaimed = !!(await redis.get(key));
    } catch (redisReadErr: unknown) {
      const redisMsg =
        redisReadErr instanceof Error
          ? redisReadErr.message
          : String(redisReadErr);
      this.logger.warn(
        `Redis read failed for daily check-in, assuming not claimed: ${redisMsg}`,
      );
    }
    if (alreadyClaimed) {
      this.metricsService.recordDailyCheckInClaim(false);
      this.metricsService.observeCoinTransactionLatency(
        'daily_checkin',
        (Date.now() - startTime) / 1000,
      );
      const { coins_balance } = await this.getBalance(userId);
      return { claimed: false, coins_rewarded: 0, new_balance: coins_balance };
    }

    // Grant between 5 and 10 coins
    const reward = crypto.randomInt(5, 11);
    const { coins_balance } = await this.getBalance(userId);
    const newBalance = coins_balance + reward;

    const supabase = this.supabaseService.getClient();
    const { error } = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .update({ coins_balance: newBalance })
          .eq('id', userId),
      'claimDailyCheckIn',
      { logger: this.logger },
    );

    if (error) {
      this.logger.error(
        `Failed to update coin balance for daily check-in: ${error.message}`,
      );
      this.metricsService.recordCoinPurchaseError(
        'daily_checkin',
        'supabase_update',
      );
      return { claimed: false, coins_rewarded: 0, new_balance: coins_balance };
    }

    // Best-effort: set Redis key to expire in 24 hours
    try {
      const redis = this.supabaseService.getRedisClient();
      await redis.set(key, '1', 'EX', 86400);
    } catch (redisWriteErr: unknown) {
      const redisMsg =
        redisWriteErr instanceof Error
          ? redisWriteErr.message
          : String(redisWriteErr);
      this.logger.warn(
        `Redis write failed for daily check-in: ${redisMsg}. DB update succeeded.`,
      );
    }

    this.metricsService.recordDailyCheckInClaim(true);
    this.metricsService.observeCoinTransactionLatency(
      'daily_checkin',
      (Date.now() - startTime) / 1000,
    );

    this.logger.debug(
      `User ${userId} claimed daily check-in reward of ${reward} coins.`,
    );

    // Best-effort: record the transaction for history
    try {
      await supabase.from('coin_transactions').insert({
        user_id: userId,
        type: 'daily_checkin',
        amount: reward,
        description: `Daily check-in reward`,
        metadata: { coins_before: coins_balance, coins_after: newBalance },
      });
    } catch (txErr: unknown) {
      this.logger.warn(
        `Failed to record daily check-in transaction: ${txErr instanceof Error ? txErr.message : 'unknown error'}`,
      );
    }

    this.invalidateUserEconomyCaches(userId);

    return { claimed: true, coins_rewarded: reward, new_balance: newBalance };
  }

  verifyPurchaseReceipt(_dto: {
    receipt_token: string;
    platform: string;
  }): Promise<boolean> {
    // Implement server-side receipt verification logic here
    // This is a placeholder implementation
    const isValid = true; // Replace with actual verification logic
    return Promise.resolve(isValid);
  }

  async purchaseCoins(
    userId: string,
    dto: PurchaseCoinsDto,
  ): Promise<{ coins: number; new_balance: number }> {
    const startTime = Date.now();
    const supabase = this.supabaseService.getClient();

    const platform = this.detectPlatform(dto.receipt_token);

    if (dto.platform && dto.platform !== platform) {
      this.metricsService.recordCoinFraudAttempt(platform, 'platform_mismatch');
      throw new BadRequestException(
        `Receipt platform (${platform}) does not match provided platform (${dto.platform})`,
      );
    }

    const isReceiptValid = await this.verifyPurchaseReceipt({
      receipt_token: dto.receipt_token,
      platform,
    });

    if (!isReceiptValid) {
      this.metricsService.recordCoinFraudAttempt(platform, 'invalid_receipt');
      throw new BadRequestException('Invalid purchase receipt');
    }

    // For web (Stripe) ensure a pending purchase record was created server-side
    if (platform === 'web') {
      const sessionId = this.extractStripeSessionId(dto.receipt_token);
      const { data: pendingRecord, error: pendingError } =
        await withExponentialBackoff(
          () =>
            supabase
              .from('coin_purchases')
              .select('*')
              .eq('user_id', userId)
              .eq('receipt_token', sessionId)
              .maybeSingle(),
          'purchaseCoins',
          { logger: this.logger },
        );

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
      const { data: existingWeb, error: existingWebError } =
        await withExponentialBackoff(
          () =>
            supabase
              .from('coin_purchases')
              .select('*')
              .eq('user_id', userId)
              .eq('receipt_token', sessionId)
              .maybeSingle(),
          'supabaseOperation',
          { logger: this.logger },
        );

      if (existingWebError) {
        throw new InternalServerErrorException(
          'Failed to look up purchase record',
        );
      }

      if (!existingWeb || !isCoinPurchaseRecord(existingWeb)) {
        throw new BadRequestException('Purchase record not found');
      }

      if (existingWeb.status === 'completed') {
        this.metricsService.recordCoinFraudAttempt(
          'web',
          'duplicate_transaction',
        );
        throw new ConflictException(
          'This transaction has already been processed',
        );
      }

      const { error: updateWebError } = await withExponentialBackoff(
        () =>
          supabase
            .from('coin_purchases')
            .update({
              status: 'completed',
              transaction_id: transactionId || sessionId,
            })
            .eq('user_id', userId)
            .eq('receipt_token', sessionId),
        'supabaseOperation',
        { logger: this.logger },
      );

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
      const { data: existing } = await withExponentialBackoff(
        () =>
          supabase
            .from('coin_purchases')
            .select('id')
            .eq('transaction_id', transactionId)
            .maybeSingle(),
        'supabaseOperation',
        { logger: this.logger },
      );
      if (existing) {
        this.metricsService.recordCoinFraudAttempt(
          platform,
          'duplicate_transaction',
        );
        throw new ConflictException(
          'This transaction has already been processed',
        );
      }

      const { error: insertError } = await withExponentialBackoff(
        () =>
          supabase.from('coin_purchases').insert({
            user_id: userId,
            package_id: coinPackage.id,
            coins_added: coinPackage.coins,
            amount_paid: coinPackage.price,
            currency: 'usd',
            receipt_token: dto.receipt_token,
            platform,
            transaction_id: transactionId,
            status: 'completed',
          }),
        'supabaseOperation',
        { logger: this.logger },
      );

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
    const { data: userData, error: userError } = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .select('coins_balance')
          .eq('id', userId)
          .single(),
      'supabaseOperation',
      { logger: this.logger },
    );

    if (userError || !userData) {
      // For non-web platforms roll back the purchase record; for web the record
      // is already finalised but we log and return a helpful error.
      if (platform !== 'web') {
        await withExponentialBackoff(
          () =>
            supabase
              .from('coin_purchases')
              .delete()
              .eq('transaction_id', transactionId),
          'supabaseOperation',
          { logger: this.logger },
        );
      }
      this.logger.error(
        `Failed to retrieve user balance during purchase for ${userId}.`,
      );
      throw new BadRequestException('User not found');
    }

    const currentBalance =
      typeof userData.coins_balance === 'number' ? userData.coins_balance : 0;
    const newBalance = currentBalance + coinPackage.coins;

    const { error: updateError } = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .update({ coins_balance: newBalance })
          .eq('id', userId),
      'supabaseOperation',
      { logger: this.logger },
    );

    if (updateError) {
      if (platform !== 'web') {
        await withExponentialBackoff(
          () =>
            supabase
              .from('coin_purchases')
              .delete()
              .eq('transaction_id', transactionId),
          'supabaseOperation',
          { logger: this.logger },
        );
      }
      this.logger.error(
        `Failed to credit coin balance for user ${userId}: ${updateError.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to credit coin balance.  Your payment was recorded; please contact support.',
      );
    }

    this.logger.info(
      `User ${userId} received ${coinPackage.coins} coins (transaction ${(transactionId ?? '').slice(-8) || '[unknown]'})`,
    );

    this.invalidateUserEconomyCaches(userId);
    this.metricsService.recordCoinPurchase(
      platform,
      coinPackage.id,
      'success',
      coinPackage.price,
    );
    this.metricsService.observeCoinTransactionLatency(
      'purchase_coins',
      (Date.now() - startTime) / 1000,
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

    const response = await withExponentialBackoff(
      () =>
        firstValueFrom(
          this.httpService.post(verificationUrl, {
            'receipt-data': receiptToken,
            password: sharedSecret,
            'exclude-old-transactions': true,
          }),
        ),
      'Apple receipt verification',
      { logger: this.logger },
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

    const response = await withExponentialBackoff(
      () =>
        firstValueFrom(
          this.httpService.get(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }),
        ),
      'Google Play receipt verification',
      { logger: this.logger },
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
      session = await withExponentialBackoff(
        () => this.stripe.checkout.sessions.retrieve(sessionId),
        'Stripe session retrieve',
        { logger: this.logger },
      );
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

    const giftResponse = await withExponentialBackoff(
      () =>
        supabase
          .from('virtual_gifts')
          .select('*')
          .eq('id', dto.gift_id)
          .maybeSingle(),
      'sendGift',
      { logger: this.logger },
    );
    if (!giftResponse || giftResponse.error || !giftResponse.data) {
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
    const receiverCheck = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .select('id')
          .eq('id', dto.receiver_id)
          .maybeSingle(),
      'sendGift',
      { logger: this.logger },
    );
    if (receiverCheck.error || !receiverCheck.data) {
      throw new NotFoundException('Receiver user not found.');
    }

    const { coins_balance: receiverBalance } = await this.getBalance(
      dto.receiver_id,
    );

    // Deduct and credit
    const newSenderBalance = senderBalance - gift.cost_coins;
    const newReceiverBalance = receiverBalance + gift.cost_coins;

    const { error: senderUpdateError } = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .update({ coins_balance: newSenderBalance })
          .eq('id', senderId),
      'supabaseOperation',
      { logger: this.logger },
    );

    if (senderUpdateError) {
      throw new InternalServerErrorException(
        'Failed to update sender coin balance.',
      );
    }

    const { error: receiverUpdateError } = await withExponentialBackoff(
      () =>
        supabase
          .from('users')
          .update({ coins_balance: newReceiverBalance })
          .eq('id', dto.receiver_id),
      'supabaseOperation',
      { logger: this.logger },
    );

    if (receiverUpdateError) {
      // Roll back sender's balance
      await withExponentialBackoff(
        () =>
          supabase
            .from('users')
            .update({ coins_balance: senderBalance })
            .eq('id', senderId),
        'supabaseOperation',
        { logger: this.logger },
      );
      throw new InternalServerErrorException(
        'Failed to credit receiver coin balance.',
      );
    }

    const { error: insertError } = await withExponentialBackoff(
      () =>
        supabase.from('gift_transactions').insert({
          sender_id: senderId,
          receiver_id: dto.receiver_id,
          gift_id: gift.id,
          room_id: dto.room_id || null,
          coins_spent: gift.cost_coins,
        }),
      'supabaseOperation',
      { logger: this.logger },
    );

    if (insertError) {
      // Rollback both balances
      await withExponentialBackoff(
        () =>
          supabase
            .from('users')
            .update({ coins_balance: senderBalance })
            .eq('id', senderId),
        'supabaseOperation',
        { logger: this.logger },
      );
      await withExponentialBackoff(
        () =>
          supabase
            .from('users')
            .update({ coins_balance: receiverBalance })
            .eq('id', dto.receiver_id),
        'supabaseOperation',
        { logger: this.logger },
      );
      throw new InternalServerErrorException(
        'Failed to record gift transaction.',
      );
    }

    const senderProfile = await this.usersService.getProfile(senderId);
    const receiverProfile = await this.usersService.getProfile(dto.receiver_id);

    // Trim payload to only essential fields for real-time broadcast.
    // animation_url can be hundreds of bytes; send it only when populated.
    const giftEvent: GiftEventPayload = sanitiseEconomyData<GiftEventPayload>({
      type: 'virtual_gift',
      gift_id: gift.id,
      gift_name: gift.name,
      icon: gift.icon,
      animation_url: gift.animation_url?.slice(0, 512) ?? '',
      animation_type: gift.animation_type,
      coin_value: gift.cost_coins,
      sender_name: senderProfile?.display_name ?? null,
      receiver_name: receiverProfile?.display_name ?? null,
      room_id: dto.room_id,
    });

    // Broadcast the animated gift to the recipient's user channel
    // and, when applicable, the room channel for the live feed.
    // Fire-and-forget: Centrifugo failures must not fail gift-send
    this.centrifugoService
      .publish(`user_${dto.receiver_id}`, giftEvent)
      .catch((pubErr: unknown) => {
        const pubMsg =
          pubErr instanceof Error ? pubErr.message : String(pubErr);
        this.logger.warn(
          `Centrifugo publish to user_${dto.receiver_id} failed: ${pubMsg}`,
        );
      });
    if (dto.room_id) {
      this.centrifugoService
        .publish(`room_${dto.room_id}`, giftEvent)
        .catch((pubErr: unknown) => {
          const pubMsg =
            pubErr instanceof Error ? pubErr.message : String(pubErr);
          this.logger.warn(
            `Centrifugo publish to room_${dto.room_id} failed: ${pubMsg}`,
          );
        });

      // Also insert a gift chat message so it appears in the chat feed
      this.insertGiftChatMessage(senderId, dto.room_id, gift).catch(
        (insertErr: unknown) => {
          const insertMsg =
            insertErr instanceof Error ? insertErr.message : String(insertErr);
          this.logger.warn(
            `Failed to insert gift chat message for room ${dto.room_id}: ${insertMsg}`,
          );
        },
      );
    }

    this.invalidateUserEconomyCaches(senderId);
    this.invalidateUserEconomyCaches(dto.receiver_id);
    this.metricsService.recordGiftSent(
      gift.id,
      gift.animation_type,
      gift.cost_coins,
    );

    return sanitiseEconomyData({
      success: true,
      coins_remaining: newSenderBalance,
      gift,
    });
  }

  /** Inserts a gift message into the chat feed so GiftAnimationComponent can render it inline. */
  private async insertGiftChatMessage(
    senderId: string,
    roomId: string,
    gift: VirtualGiftRow,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const { error: insertError, data: savedMessage } = await supabase
      .from('chat_messages')
      .insert({
        room_id: roomId,
        sender_id: senderId,
        message_type: 'gift',
        gift_payload: {
          gift_id: gift.id,
          gift_name: gift.name,
          gift_icon: gift.icon,
          coin_value: gift.cost_coins,
          animation_type: gift.animation_type,
          animation_url: gift.animation_url?.slice(0, 512) ?? null,
        },
      })
      .select(
        `
        *,
        sender:users!chat_messages_sender_id_fkey (
          id,
          display_name,
          avatar_url
        )
      `,
      )
      .single();

    if (insertError || !savedMessage) {
      throw new Error(
        `Failed to insert gift chat message: ${insertError?.message ?? 'Unknown error'}`,
      );
    }

    // Publish to Centrifugo chat channel so receivers see it immediately
    await this.centrifugoService.publish(`chat:${roomId}`, {
      message: savedMessage,
    });
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
    const response = await withExponentialBackoff(
      () =>
        supabase.rpc('unlock_sticker_pack_atomic', {
          p_user_id: userId,
          p_pack_id: dto.pack_id,
        }),
      'unlockStickerPack',
      { logger: this.logger },
    );

    if (response.error) {
      const message = response.error.message;
      if (message.includes('STICKER_PACK_NOT_FOUND')) {
        throw new NotFoundException(`Sticker pack '${dto.pack_id}' not found.`);
      }
      if (message.includes('USER_NOT_FOUND')) {
        throw new NotFoundException('User not found.');
      }
      if (message.includes('INSUFFICIENT_COINS')) {
        throw new BadRequestException('Insufficient coin balance.');
      }

      this.logger.error(
        `Atomic sticker pack unlock failed for user ${userId}: ${message}`,
      );
      throw new InternalServerErrorException('Failed to unlock sticker pack.');
    }

    const row = Array.isArray(response.data) ? response.data[0] : undefined;
    if (!isStickerUnlockRpcRow(row) || !row.success) {
      this.logger.error(
        `Atomic sticker pack unlock returned an invalid result for user ${userId}.`,
      );
      throw new InternalServerErrorException('Failed to unlock sticker pack.');
    }

    const pack: StickerPackRow = {
      id: row.pack_id,
      name: row.pack_name,
      cost_coins: row.pack_cost_coins,
      is_animated: row.pack_is_animated,
      sticker_urls: row.pack_sticker_urls,
      animation_url: row.pack_animation_url,
    };

    this.invalidateUserEconomyCaches(userId);
    if (row.newly_unlocked) {
      this.metricsService.recordStickerPurchase(pack.id, pack.cost_coins);
    }

    return sanitiseEconomyData({
      success: true,
      coins_remaining: row.coins_remaining,
      pack,
    });
  }

  async getStickerPacks(userId: string): Promise<{
    packs: StickerPackRow[];
    owned_pack_ids: string[];
    user_coins: number;
  }> {
    // Graceful: check Redis cache with full failure tolerance
    const cacheKey = `${EconomyService.STICKER_PACKS_CACHE_PREFIX}${userId}`;
    try {
      const redis = this.supabaseService.getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          const parsed: unknown = JSON.parse(cached);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'packs' in parsed &&
            'owned_pack_ids' in parsed &&
            'user_coins' in parsed
          ) {
            return parsed as {
              packs: StickerPackRow[];
              owned_pack_ids: string[];
              user_coins: number;
            };
          }
        } catch {
          this.logger.warn(
            `Invalid sticker packs cache entry for user ${userId}, falling back to DB`,
          );
        }
      }
    } catch (redisError: unknown) {
      this.logger.warn(
        `Redis unavailable for sticker packs cache: ${redisError instanceof Error ? redisError.message : 'unknown error'}, falling back to DB`,
      );
    }

    // Graceful: DB query with fallback to default sticker packs on failure
    try {
      const supabase = this.supabaseService.getClient();

      const [packsResponse, ownedResponse, balanceResponse] = await Promise.all(
        [
          supabase
            .from('sticker_packs')
            .select('*')
            .order('cost_coins', { ascending: true }),
          supabase
            .from('user_sticker_packs')
            .select('pack_id')
            .eq('user_id', userId),
          supabase
            .from('users')
            .select('coins_balance')
            .eq('id', userId)
            .single(),
        ],
      );

      const packs: StickerPackRow[] = (packsResponse.data ?? []).filter(
        (item: unknown): item is StickerPackRow =>
          typeof item === 'object' &&
          item !== null &&
          'id' in item &&
          'name' in item &&
          'cost_coins' in item,
      );

      let result: {
        packs: StickerPackRow[];
        owned_pack_ids: string[];
        user_coins: number;
      };

      if (packs.length === 0) {
        result = sanitiseEconomyData({
          packs: this.getDefaultStickerPacks(),
          owned_pack_ids: ownedResponse.data?.map((r) => r.pack_id) ?? [],
          user_coins: balanceResponse.data?.coins_balance ?? 0,
        });
      } else {
        result = sanitiseEconomyData({
          packs,
          owned_pack_ids: ownedResponse.data?.map((r) => r.pack_id) ?? [],
          user_coins: balanceResponse.data?.coins_balance ?? 0,
        });
      }

      // Best-effort cache write; non-critical if it fails
      try {
        const redis = this.supabaseService.getRedisClient();
        redis
          .set(
            cacheKey,
            JSON.stringify(result),
            'EX',
            EconomyService.STICKER_PACKS_CACHE_TTL,
          )
          .catch(() => {
            // Redis write failure is non-critical
          });
      } catch {
        // Redis client access failure is non-critical
      }

      return result;
    } catch (dbError: unknown) {
      this.logger.warn(
        `Database unavailable for sticker packs query: ${dbError instanceof Error ? dbError.message : 'unknown error'}, returning default sticker packs`,
      );
      return sanitiseEconomyData({
        packs: this.getDefaultStickerPacks(),
        owned_pack_ids: [],
        user_coins: 50,
      });
    }
  }

  /**
   * Returns the last 50 coin transactions for the authenticated user,
   * ordered most-recent first. Falls back to an empty array when the
   * coin_transactions table is unavailable.
   */
  async getTransactionHistory(userId: string): Promise<CoinTransactionRow[]> {
    try {
      const supabase = this.supabaseService.getClient();
      const response = await withExponentialBackoff(
        () =>
          supabase
            .from('coin_transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),
        'getTransactionHistory',
        { logger: this.logger },
      );

      if (response.error || !response.data) {
        this.logger.warn(
          `Failed to fetch transaction history for user ${userId}: ${response.error?.message ?? 'no data'}`,
        );
        return [];
      }

      return (response.data as CoinTransactionRow[]).filter(
        (row: unknown): row is CoinTransactionRow =>
          typeof row === 'object' &&
          row !== null &&
          'id' in row &&
          'user_id' in row &&
          'type' in row &&
          'amount' in row &&
          'created_at' in row,
      );
    } catch (dbError: unknown) {
      this.logger.warn(
        `Database unavailable for transaction history: ${dbError instanceof Error ? dbError.message : 'unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Invalidates Redis caches related to a user's economy state.
   * Called after any mutation that changes balances or ownership
   * (purchaseCoins, sendGift, unlockStickerPack, claimDailyCheckIn).
   */
  private invalidateUserEconomyCaches(userId: string): void {
    try {
      const redis = this.supabaseService.getRedisClient();
      redis
        .del(`${EconomyService.STICKER_PACKS_CACHE_PREFIX}${userId}`)
        .catch(() => {
          // Redis invalidation failure is non-critical; cache entries expire via TTL
        });
    } catch {
      // Redis client access failure is non-critical; cache entries expire via TTL
    }
  }

  private getDefaultStickerPacks(): StickerPackRow[] {
    return [
      {
        id: 'stk_pack_1',
        name: 'Happy Corgi Pack',
        cost_coins: 50,
        is_animated: false,
        sticker_urls: [
          'assets/stickers/happy.png',
          'assets/stickers/laugh.png',
          'assets/stickers/love.png',
        ],
      },
      {
        id: 'stk_pack_2',
        name: 'Rainbow Unicorns',
        cost_coins: 200,
        is_animated: true,
        sticker_urls: [
          'assets/stickers/unicorn-gallop.webm',
          'assets/stickers/unicorn-sparkle.webm',
        ],
        animation_url: 'assets/animations/unicorn.json',
      },
      {
        id: 'stk_pack_3',
        name: 'Study Buddies',
        cost_coins: 100,
        is_animated: false,
        sticker_urls: [
          'assets/stickers/book.png',
          'assets/stickers/pencil.png',
          'assets/stickers/backpack.png',
        ],
      },
      {
        id: 'stk_pack_4',
        name: 'Golden Dragons',
        cost_coins: 500,
        is_animated: true,
        sticker_urls: [
          'assets/stickers/dragon-fire.webm',
          'assets/stickers/dragon-fly.webm',
        ],
        animation_url: 'assets/animations/dragon.json',
      },
      {
        id: 'stk_pack_5',
        name: 'Party Animals',
        cost_coins: 150,
        is_animated: true,
        sticker_urls: [
          'assets/stickers/dog-dance.webm',
          'assets/stickers/cat-party.webm',
          'assets/stickers/bird-dj.webm',
        ],
        animation_url: 'assets/animations/party.json',
      },
      {
        id: 'stk_pack_6',
        name: 'Chill Vibes',
        cost_coins: 80,
        is_animated: false,
        sticker_urls: [
          'assets/stickers/coffee.png',
          'assets/stickers/sunset.png',
          'assets/stickers/hammock.png',
        ],
      },
      {
        id: 'stk_pack_7',
        name: 'Foodie Fun',
        cost_coins: 120,
        is_animated: false,
        sticker_urls: [
          'assets/stickers/pizza.png',
          'assets/stickers/sushi.png',
          'assets/stickers/taco.png',
        ],
      },
      {
        id: 'stk_pack_8',
        name: 'Travel Stamps',
        cost_coins: 180,
        is_animated: false,
        sticker_urls: [
          'assets/stickers/passport.png',
          'assets/stickers/suitcase.png',
          'assets/stickers/camera.png',
        ],
      },
    ];
  }
}
