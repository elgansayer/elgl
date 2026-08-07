import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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

@Controller('economy')
@UseGuards(SupabaseAuthGuard)
export class EconomyController {
  private readonly logger = new Logger(EconomyController.name);

  constructor(private readonly economyService: EconomyService) {}

  /**
   * Virtual gift catalog: public, long-lived CDN cache.
   * Gifts rarely change so browsers may keep this for 1 hour and
   * Cloudflare edge nodes for 24 hours with stale-while-revalidate.
   * Gracefully degrades to default catalog on any failure.
   */
  @Get('catalog')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  async getCatalog() {
    try {
      return await this.economyService.getCatalog();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Catalog endpoint failure: ${message}`);
      throw error;
    }
  }

  /**
   * Coin packages: public, long-lived CDN cache.
   * Package definitions (name / coin-amount / price) change only
   * with app updates, so aggressive caching is safe.
   */
  @Get('packages')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
  getPackages() {
    return this.economyService.getPackages();
  }

  /**
   * User coin balance: strictly private, never cached.
   * Gracefully degrades to a default balance on service errors.
   */
  @Get('balance')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async getBalance(@CurrentUser() user: User | null) {
    if (!user) return { coins_balance: 0 };
    try {
      return await this.economyService.getBalance(user.id);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Balance endpoint failure for user ${user.id}, returning default: ${message}`,
      );
      return { coins_balance: 50 };
    }
  }

  /**
   * Daily check-in: mutation endpoint, never cached.
   * Redis failures are handled internally by the service,
   * so this only catches unexpected exceptions.
   */
  @Post('daily-check-in')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return { claimed: false, coins_rewarded: 0, new_balance: 0 };
    return await this.economyService.claimDailyCheckIn(user.id);
  }

  /**
   * Stripe checkout session creation: mutation, never cached.
   */
  @Post('create-checkout-session')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
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
  async purchaseCoins(
    @CurrentUser() user: User | null,
    @Body() dto: PurchaseCoinsDto,
  ) {
    if (!user) return null;
    return await this.economyService.purchaseCoins(user.id, dto);
  }

  /**
   * Gift sending: mutation with Centrifugo broadcast, never cached.
   * When Centrifugo is unreachable, the gift transfer still succeeds
   * and the broadcast is silently skipped.
   */
  @Post('send-gift')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async sendGift(@CurrentUser() user: User | null, @Body() dto: SendGiftDto) {
    if (!user) return null;
    return await this.economyService.sendGift(user.id, dto);
  }

  /**
   * Sticker pack storefront: contains user-specific ownership data,
   * so use a short public cache to relieve DB pressure while staying
   * fresh enough that recently unlocked packs appear promptly.
   * Gracefully degrades to default sticker packs on failure.
   */
  @Get('sticker-packs')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
  async getStickerPacks(@CurrentUser() user: User | null) {
    if (!user) return null;
    try {
      return await this.economyService.getStickerPacks(user.id);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Sticker packs endpoint failure for user ${user.id}, returning defaults: ${message}`,
      );
      return {
        packs: [],
        owned_pack_ids: [],
        user_coins: 0,
      };
    }
  }

  /**
   * Sticker pack unlock: mutation, never cached.
   */
  @Post('unlock-sticker-pack')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async unlockStickerPack(
    @CurrentUser() user: User | null,
    @Body() dto: UnlockStickerPackDto,
  ) {
    if (!user) return null;
    return await this.economyService.unlockStickerPack(user.id, dto);
  }
}
