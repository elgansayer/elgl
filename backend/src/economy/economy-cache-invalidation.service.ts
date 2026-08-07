import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { ECONOMY_CACHE_KEYS } from './economy-cache.config';

/**
 * Lightweight service that only invalidates economy-related Redis cache
 * keys.  It depends on nothing except SupabaseService so every module can
 * import `EconomyModule` (or just this service if providedIn root) without
 * risking circular dependency chains.
 *
 * Any service that mutates `coins_balance` (monetisation, escrow, audio-rooms,
 * language-challenges, shopping, apple-notification) should inject this and
 * call `invalidateUserBalanceCache(userId)` after the mutation succeeds.
 */
@Injectable()
export class EconomyCacheInvalidationService {
  private readonly logger = new Logger(EconomyCacheInvalidationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  /** Invalidate the cached coin balance for a single user. */
  async invalidateUserBalanceCache(userId: string): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.del(ECONOMY_CACHE_KEYS.USER_BALANCE(userId));
      this.logger.debug(`Invalidated balance cache for user ${userId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate balance cache for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /** Invalidate the cached sticker pack storefront for a single user. */
  async invalidateStickerPackCache(userId: string): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.del(ECONOMY_CACHE_KEYS.STICKER_PACKS(userId));
      this.logger.debug(`Invalidated sticker pack cache for user ${userId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate sticker pack cache for user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  /** Invalidate the global gift catalog cache. */
  async invalidateGiftCatalogCache(): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.del(ECONOMY_CACHE_KEYS.GIFT_CATALOG);
      this.logger.debug('Invalidated gift catalog cache');
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate gift catalog cache: ${(err as Error).message}`,
      );
    }
  }

  /** Invalidate the global coin packages cache. */
  async invalidateCoinPackagesCache(): Promise<void> {
    try {
      const redis = this.getRedis();
      await redis.del(ECONOMY_CACHE_KEYS.COIN_PACKAGES);
      this.logger.debug('Invalidated coin packages cache');
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate coin packages cache: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Invalidate ALL economy caches.  Use sparingly (bulk admin ops, seed
   * data changes).
   */
  async invalidateAllEconomyCaches(): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys('economy:*');
      if (keys.length > 0) {
        await redis.del(...keys);
        this.logger.info(`Invalidated ${keys.length} economy cache key(s)`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate all economy caches: ${(err as Error).message}`,
      );
    }
  }
}