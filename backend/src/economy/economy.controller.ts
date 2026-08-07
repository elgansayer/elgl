import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import {
  CacheControlInterceptor,
  CACHE_PUBLIC_LONG,
  CACHE_PUBLIC_SHORT,
  CACHE_PRIVATE_NO_STORE,
} from './cache.interceptor';
import { EconomyExceptionFilter } from './economy-exception.filter';

/**
 * Virtual Coin Economy Controller
 *
 * Manages the in-app virtual coin economy including:
 * - Gift catalogue browsing
 * - Coin package purchasing via Stripe / Apple / Google Play
 * - Daily check-in coin rewards
 * - Virtual gift sending with real-time Centrifugo broadcasts
 * - Sticker pack storefront and unlocking
 *
 * All endpoints require Supabase JWT authentication.
 * User-specific balance and mutation endpoints are never cached.
 * Public catalogue endpoints use aggressive CDN caching.
 */
@ApiTags('Virtual Coin Economy')
@Controller('economy')
@UseGuards(SupabaseAuthGuard)
@UseFilters(EconomyExceptionFilter)
@ApiBearerAuth()
export class EconomyController {
  constructor(private readonly economyService: EconomyService) {}

  @Get('catalog')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get the virtual gift catalogue',
    description:
      'Returns the full catalogue of virtual gifts available in the app. Gifts are sorted by coin cost in ascending order. The response is cached aggressively (1 hour in browser, 24 hours at the CDN edge with stale-while-revalidate) because the gift catalogue changes infrequently with app updates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of virtual gift objects.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'gift_rose' },
          name: { type: 'string', example: 'Rose' },
          icon: { type: 'string', example: '\ud83c\udf39' },
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

  @Get('packages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get available coin packages for purchase',
    description:
      'Returns the list of coin packages that users can purchase with real currency. Package definitions (name, coin amount, price) only change with app updates, so aggressive caching is safe. Prices are returned in the minor currency unit (e.g. cents/pence). Each package includes platform-specific product IDs for Apple App Store, Google Play, and Stripe.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of coin package objects.',
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

  @Get('balance')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Get the current user coin balance',
    description:
      'Returns the authenticated user current coin balance. This endpoint is strictly private and never cached. New users receive a default starting balance of 50 coins. Unauthenticated requests return a zero balance.',
  })
  @ApiResponse({
    status: 200,
    description: 'User coin balance.',
    schema: {
      type: 'object',
      properties: {
        coins_balance: { type: 'number', example: 150 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getBalance(@CurrentUser() user: User | null) {
    if (!user) return { coins_balance: 0 };
    return await this.economyService.getBalance(user.id);
  }

  @Post('daily-check-in')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Claim the daily check-in coin reward',
    description:
      'Claims the daily coin reward for the authenticated user. The reward scales with the consecutive check-in streak: day 1 = 5 coins, day 2 = 6 coins, through day 7 = 11 coins. The streak resets after a missed day. A user can only claim once per calendar day (UTC). Consecutive claims within the same UTC day return `claimed: false`.',
  })
  @ApiResponse({
    status: 201,
    description: 'Daily check-in result.',
    schema: {
      type: 'object',
      properties: {
        claimed: { type: 'boolean', example: true },
        coins_rewarded: { type: 'number', example: 8 },
        new_balance: { type: 'number', example: 158 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.claimDailyCheckIn(user.id);
  }

  @Post('create-checkout-session')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Create a Stripe checkout session for a coin package',
    description:
      'Creates a Stripe Checkout session for the specified coin package. Returns a session URL that the client should redirect the user to for payment. The coin balance is NEVER credited here: the client must call `POST /economy/purchase-coins` with the completed checkout session ID as the receipt token, which re-verifies payment status with the Stripe API before granting coins. This ensures a client can never grant itself coins by lying about payment success.',
  })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created successfully.',
    schema: {
      type: 'object',
      properties: {
        sessionUrl: {
          type: 'string',
          example: 'https://checkout.stripe.com/c/pay/cs_test_xxx',
        },
        sessionId: { type: 'string', example: 'cs_test_xxx' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or unknown package ID.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
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

  @Post('purchase-coins')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Verify a purchase receipt and credit coins to user balance',
    description:
      'Verifies a purchase receipt (Apple App Store IAP, Google Play Billing, or Stripe Checkout) and credits the corresponding coin amount to the authenticated user balance. The receipt is verified server-side with the respective platform API using cryptographic signature checks. The coin amount is derived from the product ID on the server to prevent client-side tampering. Duplicate transaction IDs are rejected with HTTP 409 to prevent double-crediting. The `platform` field defaults to `web` when omitted.',
  })
  @ApiResponse({
    status: 201,
    description: 'Coins credited successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        coins_added: { type: 'number', example: 100 },
        new_balance: { type: 'number', example: 250 },
        transaction_id: { type: 'string', example: 'txn_abc123' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid receipt token, unsupported platform, or unknown product ID.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 409,
    description: 'Duplicate transaction. Coins already credited for this receipt.',
  })
  async purchaseCoins(
    @CurrentUser() user: User | null,
    @Body() dto: PurchaseCoinsDto,
  ) {
    if (!user) return null;
    return await this.economyService.purchaseCoins(user.id, dto);
  }

  @Post('send-gift')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Send a virtual gift to another user',
    description:
      'Sends a virtual gift from the authenticated user to another user. The sender must have sufficient coin balance to cover the gift cost, which is deducted immediately. A real-time gift notification is broadcast to the recipient via Centrifugo WebSocket so their UI updates instantly. An optional `room_id` can associate the gift with a specific chat room context.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gift sent successfully.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'gift_txn_uuid' },
        sender_id: { type: 'string', example: 'user_uuid_sender' },
        receiver_id: { type: 'string', example: 'user_uuid_receiver' },
        gift_id: { type: 'string', example: 'gift_rose' },
        gift_name: { type: 'string', example: 'Rose' },
        cost_coins: { type: 'number', example: 10 },
        new_balance: { type: 'number', example: 140 },
        room_id: {
          type: 'string',
          nullable: true,
          example: 'room_uuid',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid receiver ID, gift ID, or malformed request body.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 402,
    description:
      'Insufficient coin balance. The sender does not have enough coins to cover the gift cost.',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient user or gift not found.',
  })
  async sendGift(@CurrentUser() user: User | null, @Body() dto: SendGiftDto) {
    if (!user) return null;
    return await this.economyService.sendGift(user.id, dto);
  }

  @Get('sticker-packs')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiOperation({
    summary: 'Get sticker pack storefront with user ownership status',
    description:
      'Returns all available sticker packs with the authenticated user ownership and unlock status. The response is cached with a short TTL (public, max-age=60s) to relieve database pressure while ensuring recently unlocked packs appear promptly. Each pack entry includes whether the user currently owns it; owned packs include the full sticker URL list. Unauthenticated requests receive an empty response.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sticker pack storefront with user-specific ownership data.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sticker_pack_animated' },
          name: { type: 'string', example: 'Animated Expressions' },
          cost_coins: { type: 'number', example: 50 },
          is_animated: { type: 'boolean', example: true },
          sticker_urls: {
            type: 'array',
            nullable: true,
            items: { type: 'string' },
            example: [
              'https://r2.example.com/stickers/pack1/sticker1.webp',
            ],
          },
          owned: { type: 'boolean', example: false },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getStickerPacks(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.getStickerPacks(user.id);
  }

  @Post('unlock-sticker-pack')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiOperation({
    summary: 'Unlock a sticker pack using coins',
    description:
      'Unlocks a sticker pack for the authenticated user by deducting the pack coin cost from their balance. The user must have sufficient coins and must not already own the pack (HTTP 409 if already owned). Once unlocked, all stickers in the pack become available for use in chat messages. The sticker pack data is also returned in the `GET /economy/sticker-packs` response going forward.',
  })
  @ApiResponse({
    status: 201,
    description: 'Sticker pack unlocked successfully.',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        pack_id: { type: 'string', example: 'sticker_pack_animated' },
        pack_name: { type: 'string', example: 'Animated Expressions' },
        cost_coins: { type: 'number', example: 50 },
        new_balance: { type: 'number', example: 100 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or unknown pack ID.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 402,
    description: 'Insufficient coin balance to unlock this pack.',
  })
  @ApiResponse({
    status: 409,
    description: 'Sticker pack already owned by this user.',
  })
  async unlockStickerPack(
    @CurrentUser() user: User | null,
    @Body() dto: UnlockStickerPackDto,
  ) {
    if (!user) return null;
    return await this.economyService.unlockStickerPack(user.id, dto);
  }
}
