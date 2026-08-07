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
  CACHE_NO_STORE,
} from './cache.interceptor';
import { EconomyExceptionFilter } from './economy-exception.filter';
import {
  EconomyRateLimiterGuard,
  EconomyRateLimit,
} from './economy-rate-limiter.guard';

@Controller('economy')
@UseGuards(SupabaseAuthGuard, EconomyRateLimiterGuard)
@UseFilters(EconomyExceptionFilter)
export class EconomyController {
  constructor(private readonly economyService: EconomyService) {}

  /**
   * Virtual gift catalog: public, long-lived CDN cache.
   * Gifts rarely change so browsers may keep this for 1 hour and
   * Cloudflare edge nodes for 24 hours with stale-while-revalidate.
   */
  @Get('catalog')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_LONG))
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
  async getBalance(@CurrentUser() user: User | null) {
    if (!user) return { coins_balance: 0 };
    return await this.economyService.getBalance(user.id);
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
  async claimDailyCheckIn(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.economyService.claimDailyCheckIn(user.id);
  }

  /**
   * Stripe checkout session creation: mutation, never cached.
   * Tightly rate-limited because each call creates a real Stripe session.
   */
  @Post('create-checkout-session')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EconomyRateLimit({ maxRequests: 5, windowSeconds: 60 })
  @UseInterceptors(new CacheControlInterceptor(CACHE_NO_STORE))
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(new CacheControlInterceptor(CACHE_PUBLIC_SHORT))
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
  async unlockStickerPack(
    @CurrentUser() user: User | null,
    @Body() dto: UnlockStickerPackDto,
  ) {
    if (!user) return null;
    return await this.economyService.unlockStickerPack(user.id, dto);
  }
}
