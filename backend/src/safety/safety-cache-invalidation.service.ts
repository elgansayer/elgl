import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CloudflareCacheService } from '../cloudflare/cache.service';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Cache-Tag values used by the Discovery module for Cloudflare edge caching.
 * These are kept as plain string literals (not an import from the discovery
 * module) to avoid a circular dependency between Safety and Discovery modules.
 */
const DISCOVERY_CACHE_TAG_PUBLIC = 'discovery:public';
const DISCOVERY_CACHE_TAG_PRIVATE = 'discovery:private';

/**
 * Cache key prefixes maintained by the Safety & Trust module.
 * These prefixes mirror the cache keys written by other services
 * (admin, discovery, recommendations) that must be invalidated when
 * block/unblock/report actions change the trust graph.
 */
const SAFETY_AFFECTED_CACHE_PATTERNS = [
  // Admin dashboard caches (admin.service.ts)
  'admin:users:list:*',
  'admin:blocks:list:*',
  'admin:login-history:',

  // Discovery caches (discovery.service.ts)
  'partner_of_week_ids',

  // Recommendations caches (recommendations.service.ts)
  'daily_recommendations:',
  'recommendations:daily:',
] as const;

const SCAN_BATCH_SIZE = 500;

@Injectable()
export class SafetyCacheInvalidationService {
  private readonly logger = new Logger(SafetyCacheInvalidationService.name);

  constructor(
    private readonly cloudflareCacheService: CloudflareCacheService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  /**
   * Invalidate all caches affected by a block, unblock, or report action.
   *
   * Strategy:
   *  - For suffixed patterns (e.g. `admin:users:list:*`), scan and delete
   *    matching keys using SCAN to avoid blocking the Redis event loop.
   *  - For exact keys (e.g. `partner_of_week_ids`), delete directly.
   *  - For prefix-only patterns (e.g. `recommendations:daily:`),
   *    scan using KEYS (the Redis instance is small enough that this is
   *    safe for pattern-only prefixes; SCAN does not support glob-style
   *    matching natively).
   */
  async invalidateTrustAndSafetyCaches(): Promise<void> {
    const redis = this.getRedis();
    try {
      let totalDeleted = 0;

      for (const pattern of SAFETY_AFFECTED_CACHE_PATTERNS) {
        if (pattern.endsWith(':*')) {
          // Suffixed glob pattern – use SCAN for safety on larger key spaces
          const prefix = pattern.slice(0, -2);
          const deleted = await this.deleteByScan(redis, prefix);
          totalDeleted += deleted;
        } else if (pattern.endsWith(':')) {
          // Prefix pattern – use KEYS (acceptable for small-to-medium instances)
          const deleted = await this.deleteByPattern(redis, `${pattern}*`);
          totalDeleted += deleted;
        } else {
          // Exact single key
          const deleted = await redis.del(pattern);
          totalDeleted += deleted;
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Invalidated ${totalDeleted} cache key(s) after trust & safety mutation`,
        );
      }

      // Purge Cloudflare edge caches tagged with discovery:public and
      // discovery:private.  The public shared lists (spotlight, recent native
      // speakers) and user-specific discovery responses may be stale for up to
      // the SWR window after a block/unblock/report, so this is a best-effort
      // early invalidation.  We do NOT await this -- it is fire-and-forget;
      // the edge cache TTLs are short enough that the stale window is bounded.
      void this.cloudflareCacheService.purgeByCacheTags([
        DISCOVERY_CACHE_TAG_PUBLIC,
        DISCOVERY_CACHE_TAG_PRIVATE,
      ]);
    } catch (err) {
      this.logger.error('Failed to invalidate trust & safety caches', err);
    }
  }

  /**
   * Invalidate caches for a specific user pair affected by a block/unblock.
   * This is a more surgical invalidation that targets only the keys belonging
   * to the two users involved in the trust action.
   */
  async invalidateUserPairCaches(
    userIdA: string,
    userIdB: string,
  ): Promise<void> {
    const redis = this.getRedis();
    try {
      const keysToDelete: string[] = [];

      // Login-history caches scoped to each user
      keysToDelete.push(
        `admin:login-history:${userIdA}`,
        `admin:login-history:${userIdB}`,
      );

      // Daily recommendation caches for each user
      keysToDelete.push(
        `daily_recommendations:${userIdA}`,
        `daily_recommendations:${userIdB}`,
        `recommendations:daily:${userIdA}`,
        `recommendations:daily:${userIdB}`,
      );

      if (keysToDelete.length > 0) {
        const deleted = await redis.del(...keysToDelete);
        if (deleted > 0) {
          this.logger.log(
            `Invalidated ${deleted} user-pair cache key(s) for users ${userIdA} and ${userIdB}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to invalidate user-pair caches for ${userIdA} and ${userIdB}`,
        err,
      );
    }
  }

  /**
   * Invalidate caches for a specific user (used after reporting).
   */
  async invalidateUserCaches(userId: string): Promise<void> {
    const redis = this.getRedis();
    try {
      const keysToDelete: string[] = [
        `admin:login-history:${userId}`,
        `daily_recommendations:${userId}`,
        `recommendations:daily:${userId}`,
      ];

      const deleted = await redis.del(...keysToDelete);
      if (deleted > 0) {
        this.logger.log(
          `Invalidated ${deleted} user-scoped cache key(s) for user ${userId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to invalidate user-scoped caches for ${userId}`,
        err,
      );
    }
  }

  // ----- private helpers -----

  private async deleteByScan(redis: Redis, prefix: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${prefix}*`,
        'COUNT',
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');
    return deleted;
  }

  private async deleteByPattern(
    redis: Redis,
    pattern: string,
  ): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    return redis.del(...keys);
  }
}
