import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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

@ApiTags('Virtual Coin Economy')
@Controller('economy')
@UseGuards(SupabaseAuthGuard)
export class EconomyController {
  constructor(private readonly economyService: EconomyService) {}

  /**
   * Virtual gift catalog: public, long-lived CDN cache.
   * Gifts rarely change so browsers may keep this for 1 hour and
   * Cloudflare edge nodes for 24 hours with stale-while-revalidate.
   */
  @Get('catalog')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get virtual gift catalog',
    description:
      'Returns all available virtual gifts with their coin costs, icons, and animation types. Public endpoint with long CDN cache.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of virtual gifts',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'gift_rose' },
          name: { type: 'string', example: 'Rose' },
          icon: { type: 'string', example: 'rose_emoji' },
          cost_coins: { type: 'number', example: 10 },
          animation_type: { type: 'string', example: 'float' },
          animation_url: { type: 'string', example: 'https://r2.example.com/rose.json' },
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
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  @ApiOperation({
    summary: 'Get available coin packages',
    description:
      'Returns all coin packages with their IDs, coin amounts, and prices in both USD and UKP. Public endpoint with long CDN cache.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of coin packages',
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
        },
      },
    },
  })
  getPackages() {
    return this.economyService.getPackages();
  }

  /**
   * User coin balance: strictly private, never cached.
   */
  @Get('balance')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user coin balance',
    description:
      'Returns the authenticated user\'s current coin balance. Private endpoint; never cached.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current coin balance',
    schema: {
      type: 'object',
      properties: {
        coins_balance: { type: 'number', example: 250 },
      },
    },
  })
  async getBalance(@CurrentUser() user: User | null) {
    if (!user) return { coins_balance: 0 };
    return await this.economyService.getBalance(user.id);
  }

  /**
   * Daily check-in: mutation endpoint, never cached.
   */
  @Post('daily-check-in')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Claim daily check-in reward',
    description:
      'Grants a random coin reward (5-10 coins) to the authenticated user once per day. Rate-limited by Redis with a 24-hour expiry.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daily check-in result',
    schema: {
      type: 'object',
      properties: {
        claimed: { type: 'boolean', example: true },
        coins_rewarded: { type: 'number', example: 7 },
        new_balance: { type: 'number', example: 257 },
      },
    },
  })
  async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.claimDailyCheckIn(user.id);
  }

  /**
   * Stripe checkout session creation: mutation, never cached.
   */
  @Post('create-checkout-session')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Stripe Checkout session for coin purchase',
    description:
      'Creates a Stripe Checkout session for purchasing a coin package. Returns the checkout URL to redirect the user to for payment completion.',
  })
  @ApiResponse({
    status: 200,
    description: 'Stripe Checkout session created',
    schema: {
      type: 'object',
      properties: {
        sessionUrl: { type: 'string', example: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3' },
        sessionId: { type: 'string', example: 'cs_test_a1b2c3d4e5f6' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Coin package not found' })
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
   */
  @Post('purchase-coins')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Purchase coins with verified receipt',
    description:
      'Verifies a purchase receipt (Apple, Google, or Stripe) and credits coins to the user. The coin amount is derived server-side from the product ID to prevent client-side manipulation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase successful, coins credited',
    schema: {
      type: 'object',
      properties: {
        coins: { type: 'number', example: 100 },
        new_balance: { type: 'number', example: 350 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid receipt or mismatched platform' })
  @ApiResponse({ status: 409, description: 'Transaction already processed (duplicate receipt)' })
  async purchaseCoins(
    @CurrentUser() user: User | null,
    @Body() dto: PurchaseCoinsDto,
  ) {
    if (!user) return null;
    return await this.economyService.purchaseCoins(user.id, dto);
  }

  /**
   * Gift sending: mutation with Centrifugo broadcast, never cached.
   */
  @Post('send-gift')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a virtual gift to another user',
    description:
      'Deducts coins from the sender\'s balance, broadcasts the gift event via Centrifugo real-time channels, and records the transaction in the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gift sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        gift_id: { type: 'string', example: 'gift_rose' },
        receiver_id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
        new_balance: { type: 'number', example: 240 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Insufficient coins or invalid gift' })
  @ApiResponse({ status: 404, description: 'Gift or recipient not found' })
  async sendGift(@CurrentUser() user: User | null, @Body() dto: SendGiftDto) {
    if (!user) return null;
    return await this.economyService.sendGift(user.id, dto);
  }

  /**
   * Sticker pack storefront: contains user-specific ownership data,
   * so use a short public cache to relieve DB pressure while staying
   * fresh enough that recently unlocked packs appear promptly.
   */
  @Get('sticker-packs')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get sticker packs with ownership status',
    description:
      'Returns all available sticker packs with coin costs and whether the authenticated user owns each pack. Short public cache to balance freshness and performance.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of sticker packs with user ownership',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sticker_pack_summer_2026' },
          name: { type: 'string', example: 'Summer Vibes' },
          cost_coins: { type: 'number', example: 50 },
          is_owned: { type: 'boolean', example: false },
          is_animated: { type: 'boolean', example: true },
        },
      },
    },
  })
  async getStickerPacks(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.getStickerPacks(user.id);
  }

  /**
   * Sticker pack unlock: mutation, never cached.
   */
  @Post('unlock-sticker-pack')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unlock a sticker pack with coins',
    description:
      'Deducts the sticker pack\'s coin cost from the user\'s balance and grants permanent ownership of the pack.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sticker pack unlocked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        pack_id: { type: 'string', example: 'sticker_pack_summer_2026' },
        coins_spent: { type: 'number', example: 50 },
        new_balance: { type: 'number', example: 200 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Insufficient coins or pack already owned' })
  @ApiResponse({ status: 404, description: 'Sticker pack not found' })
  async unlockStickerPack(
    @CurrentUser() user: User | null,
    @Body() dto: UnlockStickerPackDto,
  ) {
    if (!user) return null;
    return await this.economyService.unlockStickerPack(user.id, dto);
  }
}
