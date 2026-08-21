import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CreateCoinCheckoutSessionDto,
  PurchaseCoinsDto,
  SendGiftDto,
  UnlockStickerPackDto,
} from './dto/economy.dto';
import { EconomyService } from './economy.service';
import { CoinEconomyHealthService } from './coin-economy-health.service';
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_NO_STORE,
} from '../common/cache.interceptor';
import { EconomyExceptionFilter } from './economy-exception.filter';
import {
  EconomyRateLimiterGuard,
  EconomyRateLimit,
} from './economy-rate-limiter.guard';

@ApiTags('Virtual Coin Economy')
@Controller('economy')
@UseGuards(SupabaseAuthGuard, EconomyRateLimiterGuard)
@UseFilters(EconomyExceptionFilter)
@ApiBearerAuth()
export class EconomyController {
  private readonly logger = new Logger(EconomyController.name);

  constructor(
    private readonly economyService: EconomyService,
    private readonly healthService: CoinEconomyHealthService,
  ) {}

  /**
   * Virtual gift catalog: public, long-lived CDN cache.
   * Gifts rarely change so browsers may keep this for 1 hour and
   * Cloudflare edge nodes for 24 hours with stale-while-revalidate.
   */
  @Get('catalog')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get virtual gift catalog',
    description:
      'Returns all available virtual gifts ordered by coin cost (ascending). ' +
      'Gifts rarely change, so responses are cached aggressively (1 hour browser, 24 hours CDN with stale-while-revalidate).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of virtual gifts with id, name, icon (emoji), coin cost, and animation metadata.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'gift_rose' },
          name: { type: 'string', example: 'Rose' },
          icon: { type: 'string', example: '\u{1F339}' },
          cost_coins: { type: 'number', example: 10 },
          animation_type: { type: 'string', example: 'float' },
          animation_url: {
            type: 'string',
            nullable: true,
            example: 'https://r2.example.com/rose.json',
          },
        },
      },
    },
  })
  async getCatalog() {
    return this.economyService.getCatalog();
  }

  /**
   * Coin packages: public, long-lived CDN cache.
   * Package definitions (name / coin-amount / price) change only
   * with app updates, so aggressive caching is safe.
   */
  @Get('packages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get available coin packages',
    description:
      'Returns all available coin packages for purchase across all platforms (iOS, Android, Web). ' +
      'Package definitions change only with app updates, so aggressive caching is applied.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of coin packages with id, name, coin amount, and platform-specific pricing (price_ukp, price_usd) and product IDs.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'coins_small' },
          name: { type: 'string', example: 'Small Coin Pack' },
          coins: { type: 'number', example: 100 },
          price: { type: 'number', example: 499 },
          price_ukp: { type: 'number', example: 4 },
          price_usd: { type: 'number', example: 4.99 },
          platform_product_id: {
            type: 'object',
            properties: {
              ios: {
                type: 'string',
                nullable: true,
                example: 'com.linguaexchange.coins.small',
              },
              android: {
                type: 'string',
                nullable: true,
                example: 'com.linguaexchange.coins.small',
              },
              web: {
                type: 'string',
                nullable: true,
                example: 'price_small_coins',
              },
            },
          },
        },
      },
    },
  })
  getPackages() {
    return this.economyService.getPackages();
  }

  /**
   * User coin balance: strictly private, never cached.
   * Per-user rate limit prevents balance-enumeration attacks.
   */
  @Get('balance')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get user coin balance',
    description:
      'Returns the current coin balance for the authenticated user. ' +
      'This is strictly private data and is never cached. Returns zero for unauthenticated requests.',
  })
  @ApiResponse({
    status: 200,
    description: 'User coin balance.',
    schema: {
      type: 'object',
      properties: {
        coins_balance: { type: 'number', example: 250 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getBalance(@CurrentUser() user: User | null) {
    if (!user) return { coins_balance: 0 };
    try {
      return await this.economyService.getBalance(user.id);
    } catch (err: unknown) {
      this.logger.warn(
        `Balance lookup failed for user ${user.id}: ${err instanceof Error ? err.message : 'unknown error'}, returning default balance`,
      );
      return { coins_balance: 50 };
    }
  }

  /**
   * Daily check-in: mutation endpoint, never cached.
   * Redis deduplication already prevents double-claiming per day, but the
   * per-user rate limit prevents rapid-fire Redis hammering.
   */
  @Post('daily-check-in')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 3, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Claim daily check-in reward',
    description:
      'Claims a random daily reward of 5-10 coins for the authenticated user. ' +
      'Each user can only claim once per calendar day (Redis-based rate limiting). ' +
      'Returns whether the claim succeeded, the reward amount, and the new balance.',
  })
  @ApiResponse({
    status: 201,
    description: 'Daily check-in result.',
    schema: {
      type: 'object',
      properties: {
        claimed: { type: 'boolean', example: true },
        coins_rewarded: { type: 'number', example: 7 },
        new_balance: { type: 'number', example: 257 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return null;
    try {
      return await this.economyService.claimDailyCheckIn(user.id);
    } catch (err: unknown) {
      this.logger.warn(
        `Daily check-in failed for user ${user.id}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return { claimed: false, coins_rewarded: 0, new_balance: 50 };
    }
  }

  /**
   * Stripe checkout session creation: mutation, never cached.
   * Tightly rate-limited because each call creates a real Stripe session.
   */
  @Post('create-checkout-session')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 5, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Create a Stripe Checkout session for coin purchase',
    description:
      'Creates a Stripe Checkout session for the specified coin package. ' +
      'Returns a session URL for client-side redirect to Stripe. ' +
      'The coin balance is NOT credited here -- the client must call purchase-coins ' +
      'with the session ID after payment completion.',
  })
  @ApiResponse({
    status: 201,
    description: 'Stripe Checkout session created.',
    schema: {
      type: 'object',
      properties: {
        sessionUrl: {
          type: 'string',
          example: 'https://checkout.stripe.com/pay/cs_test_abc123',
        },
        sessionId: { type: 'string', example: 'cs_test_abc123' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Package not available for web purchase.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Coin package not found.' })
  async createCheckoutSession(
    @CurrentUser() user: User | null,
    @Body() dto: CreateCoinCheckoutSessionDto,
  ) {
    if (!user) return null;
    return await this.economyService.createCheckoutSession(
      user.id,
      dto.package_id,
    );
  }

  /**
   * Coin purchase: mutation, never cached.
   * Tightly rate-limited because this interacts with external payment
   * verification APIs (Stripe / Apple / Google).
   */
  @Post('purchase-coins')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 5, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Complete a coin purchase',
    description:
      'Verifies a purchase receipt (Apple/Google/Stripe), derives the coin amount server-side ' +
      'from COIN_PACKAGES, checks for duplicate transaction IDs, and credits coins to the user. ' +
      'For web (Stripe), a pending purchase record must have been created first via create-checkout-session.',
  })
  @ApiResponse({
    status: 201,
    description: 'Coins purchased successfully.',
    schema: {
      type: 'object',
      properties: {
        coins: { type: 'number', example: 100 },
        new_balance: { type: 'number', example: 350 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid receipt or receipt verification failed.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 409, description: 'Duplicate transaction.' })
  async purchaseCoins(
    @CurrentUser() user: User | null,
    @Body() dto: PurchaseCoinsDto,
  ) {
    if (!user) return null;
    return await this.economyService.purchaseCoins(user.id, dto);
  }

  /**
   * Gift sending: mutation with Centrifugo broadcast, never cached.
   * Per-user rate limit prevents gift-spam and coin-drain enumeration.
   */
  @Post('send-gift')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Send a virtual gift to another user',
    description:
      'Deducts coins from the sender, credits the receiver, records the transaction, ' +
      'and broadcasts a real-time gift event via Centrifugo to the receiver and optionally ' +
      'to an audio room channel. The sender must have sufficient coin balance.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gift sent successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        coins_remaining: { type: 'number', example: 230 },
        gift: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'gift_rose' },
            name: { type: 'string', example: 'Rose' },
            icon: { type: 'string', example: '\u{1F339}' },
            cost_coins: { type: 'number', example: 10 },
            animation_type: { type: 'string', example: 'float' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Insufficient balance or cannot send to self.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 404,
    description: 'Gift not found in catalog or receiver not found.',
  })
  async sendGift(@CurrentUser() user: User | null, @Body() dto: SendGiftDto) {
    if (!user) return null;
    return await this.economyService.sendGift(user.id, dto);
  }

  /**
   * Transaction history: strictly private, never cached.
   * Returns the last 50 coin transactions for the authenticated user.
   */
  @Get('transactions')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 20, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get coin transaction history',
    description:
      'Returns the last 50 coin transactions (daily check-ins, purchases, gifts sent/received, sticker unlocks) ' +
      'for the authenticated user, ordered most-recent first. This is strictly private data and is never cached.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of coin transactions.',
    schema: {
      type: 'object',
      properties: {
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'abc-123' },
              type: { type: 'string', example: 'daily_checkin' },
              amount: { type: 'number', example: 7 },
              description: {
                type: 'string',
                nullable: true,
                example: 'Daily check-in reward',
              },
              created_at: {
                type: 'string',
                example: '2026-08-08T12:00:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getTransactions(@CurrentUser() user: User | null) {
    if (!user) return { transactions: [] };
    try {
      const transactions = await this.economyService.getTransactionHistory(
        user.id,
      );
      return { transactions };
    } catch (err: unknown) {
      this.logger.warn(
        `Transaction history lookup failed for user ${user.id}: ${err instanceof Error ? err.message : 'unknown error'}, returning empty list`,
      );
      return { transactions: [] };
    }
  }

  /**
   * Sticker pack storefront: contains user-specific ownership data,
   * so use a short public cache to relieve DB pressure while staying
   * fresh enough that recently unlocked packs appear promptly.
   */
  @Get('sticker-packs')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiOperation({
    summary: 'Get sticker pack storefront',
    description:
      'Returns all available sticker packs with user-specific ownership data. ' +
      'Responses are cached for 5 minutes (browser) / 30 minutes (CDN) to relieve DB pressure ' +
      'while keeping recently unlocked packs visible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sticker packs with ownership data.',
    schema: {
      type: 'object',
      properties: {
        packs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'stk_pack_1' },
              name: { type: 'string', example: 'Happy Corgi Pack' },
              cost_coins: { type: 'number', example: 50 },
              is_animated: { type: 'boolean', example: false },
              sticker_urls: {
                type: 'array',
                items: { type: 'string' },
                example: ['assets/stickers/happy.png'],
              },
            },
          },
        },
        owned_pack_ids: {
          type: 'array',
          items: { type: 'string' },
          example: ['stk_pack_1'],
        },
        user_coins: { type: 'number', example: 250 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getStickerPacks(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.getStickerPacks(user.id);
  }

  /**
   * Sticker pack unlock: mutation, never cached.
   * Per-user rate limit deters brute-force pack-unlock attempts.
   */
  @Post('unlock-sticker-pack')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 10, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Unlock a sticker pack with coins',
    description:
      'Deducts the sticker pack cost from the user coin balance and records ownership. ' +
      'The user must have sufficient coins to cover the pack cost.',
  })
  @ApiResponse({
    status: 201,
    description: 'Sticker pack unlocked.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        coins_remaining: { type: 'number', example: 200 },
        pack: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'stk_pack_1' },
            name: { type: 'string', example: 'Happy Corgi Pack' },
            cost_coins: { type: 'number', example: 50 },
            is_animated: { type: 'boolean', example: false },
            sticker_urls: {
              type: 'array',
              items: { type: 'string' },
              example: ['assets/stickers/happy.png'],
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Insufficient balance.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Sticker pack not found.' })
  async unlockStickerPack(
    @CurrentUser() user: User | null,
    @Body() dto: UnlockStickerPackDto,
  ) {
    if (!user) return null;
    return await this.economyService.unlockStickerPack(user.id, dto);
  }

  /**
   * Economy health check: returns the health status of all virtual coin
   * economy dependencies (Redis, Supabase, Stripe, Centrifugo) plus any
   * degraded features. This endpoint does NOT require authentication so
   * monitoring systems (Prometheus, Grafana) can poll it.
   */
  @Get('health')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
  @ApiOperation({
    summary: 'Get coin economy health status',
    description:
      'Returns the health status of all economy dependencies (Redis, Supabase, Stripe, Centrifugo) ' +
      'and lists any degraded features. This endpoint is unauthenticated for monitoring integration.',
  })
  @ApiResponse({
    status: 200,
    description: 'Economy health snapshot.',
    schema: {
      type: 'object',
      properties: {
        overall: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2026-08-07T12:00:00.000Z' },
        dependencies: {
          type: 'object',
          properties: {
            redis: { type: 'object' },
            supabase: { type: 'object' },
            stripe: { type: 'object' },
            centrifugo: { type: 'object' },
          },
        },
        degradedFeatures: { type: 'array', items: { type: 'string' } },
        uptimeSeconds: { type: 'number', example: 3600 },
      },
    },
  })
  async getHealth() {
    return this.healthService.getHealthSnapshot();
  }
}
