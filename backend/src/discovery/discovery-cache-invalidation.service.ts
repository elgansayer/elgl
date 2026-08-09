import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import {
  DiscoveryCacheNamespace,
  CacheInvalidationRule,
  DiscoveryCacheInvalidationTrigger,
} from './interfaces/cache-rules.interface';

/**
 * Centralised Redis cache invalidation service for the Discovery Map.
 *
 * Responsibilities:
 * - Maintains a canonical set of invalidation rules mapping cache patterns to triggers.
 * - Invalidate CDN-cached discovery data (partner-of-week, spotlight, recent-native)
 *   when underlying user data changes.
 * - Invalidate user-scoped discovery caches when a profile update affects search results.
 * - Provides bulk, pattern-based deletion using SCAN (safe for production).
 *
 * Key naming convention:
 *   discovery:{endpoint}:user:{userId}:{hash}
 *   discovery:{endpoint}:shared
 *
 * Shared/global caches (partner_of_week_ids, spotlight, recent_native) are
 * single-key or prefix keys.  User-scoped caches are suffixed with userId.
 */
@Injectable()
export class DiscoveryCacheInvalidationService {
  /** Canonical set of invalidation rules for the entire discovery surface. */
  readonly rules: ReadonlyArray<CacheInvalidationRule> = [
    {
      description:
        'Invalidate Partner of the Week when cron recalculates weekly winners',
      patterns: [DiscoveryCacheNamespace.PARTNER_OF_WEEK],
      triggers: [DiscoveryCacheInvalidationTrigger.PARTNER_OF_WEEK_UPDATED],
    },
    {
      description:
        'Invalidate daily recommendations for affected users when cron runs',
      patterns: [
        `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:*`,
        `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:*`,
      ],
      triggers: [
        DiscoveryCacheInvalidationTrigger.DAILY_RECOMMENDATIONS_UPDATED,
      ],
    },
    {
      description:
        'Invalidate user-scoped discovery caches when a profile field that affects ' +
        'search ranking changes (languages, bio, gender, age, country, city, interests, ' +
        'learning goals, proficiency level)',
      patterns: [
        `discovery:partner_search:user:*`,
        `discovery:language_pair:user:*`,
        `discovery:location_search:user:*`,
        `discovery:audio_intros:user:*`,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.USER_PROFILE_UPDATED],
    },
    {
      description:
        'Invalidate shared discovery lists when a user joins or leaves the VIP tier',
      patterns: [
        DiscoveryCacheNamespace.PARTNER_OF_WEEK,
        DiscoveryCacheNamespace.RECENT_NATIVE,
        DiscoveryCacheNamespace.SPOTLIGHT,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.USER_VIP_UPDATED],
    },
    {
      description:
        'Invalidate location-based search caches when a user changes their location',
      patterns: [
        `discovery:location_search:user:*`,
        `discovery:partner_search:user:*`,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.USER_LOCATION_UPDATED],
    },
    {
      description:
        'Invalidate shared & ranked lists when a user streak or correction ' +
        'ratio changes enough to affect serious-learner status',
      patterns: [
        `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:*`,
        `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:*`,
        DiscoveryCacheNamespace.RECENT_NATIVE,
        DiscoveryCacheNamespace.SPOTLIGHT,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.USER_METRICS_UPDATED],
    },
    {
      description:
        'Invalidate global shared lists when a new user completes onboarding',
      patterns: [
        DiscoveryCacheNamespace.RECENT_NATIVE,
        DiscoveryCacheNamespace.SPOTLIGHT,
        `discovery:partner_search:user:*`,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.NEW_USER_ONBOARDED],
    },
    {
      description:
        'Bulk-invalidate every discovery-scoped key belonging to a user ' +
        '(e.g. on account deletion, privacy hide-from-search toggle)',
      patterns: [
        `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:*`,
        `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:*`,
        `discovery:partner_search:user:*`,
        `discovery:language_pair:user:*`,
        `discovery:location_search:user:*`,
        `discovery:audio_intros:user:*`,
      ],
      triggers: [DiscoveryCacheInvalidationTrigger.USER_DISCOVERY_CLEARED],
    },
  ];

  constructor(
    @InjectPinoLogger(DiscoveryCacheInvalidationService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
  ) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  /* ------------------------------------------------------------------ */
  /*  Event-driven invalidation handlers                                 */
  /* ------------------------------------------------------------------ */

  @OnEvent('discovery.partner_of_week_updated')
  async handlePartnerOfWeekUpdated(): Promise<void> {
    const deleted = await this.getRedis().del(
      DiscoveryCacheNamespace.PARTNER_OF_WEEK,
    );
    if (deleted > 0) {
      this.logger.info(
        'Invalidated partner_of_week_ids cache (partner_of_week_updated)',
      );
    }
  }

  @OnEvent('discovery.daily_recommendations_updated')
  async handleDailyRecommendationsUpdated(): Promise<void> {
    let total = 0;
    total += await this.deleteByPattern(
      `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:*`,
    );
    total += await this.deleteByPattern(
      `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:*`,
    );
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} daily recommendation cache key(s)`,
      );
    }
  }

  @OnEvent('discovery.user_profile_updated', { async: true })
  async handleUserProfileUpdated(payload: { userId: string }): Promise<void> {
    let total = 0;
    total += await this.deleteByPattern(
      `discovery:partner_search:user:${payload.userId}:*`,
    );
    total += await this.deleteByPattern(
      `discovery:language_pair:user:${payload.userId}:*`,
    );
    total += await this.deleteByPattern(
      `discovery:location_search:user:${payload.userId}:*`,
    );
    total += await this.deleteByPattern(
      `discovery:audio_intros:user:${payload.userId}:*`,
    );
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} user-scoped discovery cache key(s) for ${payload.userId}`,
      );
    }
  }

  @OnEvent('discovery.user_vip_updated')
  async handleUserVipUpdated(): Promise<void> {
    let total = 0;
    total += await this.getRedis().del(DiscoveryCacheNamespace.PARTNER_OF_WEEK);
    total += await this.getRedis().del(DiscoveryCacheNamespace.RECENT_NATIVE);
    total += await this.getRedis().del(DiscoveryCacheNamespace.SPOTLIGHT);
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} shared discovery cache key(s) after VIP change`,
      );
    }
  }

  @OnEvent('discovery.user_location_updated', { async: true })
  async handleUserLocationUpdated(payload: { userId: string }): Promise<void> {
    let total = 0;
    total += await this.deleteByPattern(
      `discovery:location_search:user:${payload.userId}:*`,
    );
    total += await this.deleteByPattern(
      `discovery:partner_search:user:${payload.userId}:*`,
    );
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} location-scoped discovery cache key(s) for ${payload.userId}`,
      );
    }
  }

  @OnEvent('discovery.user_metrics_updated')
  async handleUserMetricsUpdated(): Promise<void> {
    let total = 0;
    total += await this.deleteByPattern(
      `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:*`,
    );
    total += await this.deleteByPattern(
      `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:*`,
    );
    total += await this.getRedis().del(DiscoveryCacheNamespace.RECENT_NATIVE);
    total += await this.getRedis().del(DiscoveryCacheNamespace.SPOTLIGHT);
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} discovery cache key(s) after metrics update`,
      );
    }
  }

  @OnEvent('discovery.new_user_onboarded')
  async handleNewUserOnboarded(): Promise<void> {
    let total = 0;
    total += await this.getRedis().del(DiscoveryCacheNamespace.RECENT_NATIVE);
    total += await this.getRedis().del(DiscoveryCacheNamespace.SPOTLIGHT);
    total += await this.deleteByPattern(`discovery:partner_search:user:*`);
    if (total > 0) {
      this.logger.info(
        `Invalidated ${total} discovery cache key(s) after new user onboarded`,
      );
    }
  }

  @OnEvent('discovery.user_discovery_cleared', { async: true })
  async handleUserDiscoveryCleared(payload: { userId: string }): Promise<void> {
    const prefixes = [
      `${DiscoveryCacheNamespace.DAILY_RECOMMENDATIONS}:${payload.userId}`,
      `${DiscoveryCacheNamespace.RECOMMENDATIONS_DAILY}:${payload.userId}`,
      `discovery:partner_search:user:${payload.userId}`,
      `discovery:language_pair:user:${payload.userId}`,
      `discovery:location_search:user:${payload.userId}`,
      `discovery:audio_intros:user:${payload.userId}`,
    ];
    // Delete exact keys and prefixed patterns
    let total = 0;
    for (const prefix of prefixes) {
      if (prefix.includes(':')) {
        total += await this.deleteByPattern(`${prefix}:*`);
      }
      total += await this.getRedis().del(prefix);
    }
    if (total > 0) {
      this.logger.info(
        `Bulk-invalidated ${total} discovery cache key(s) for user ${payload.userId}`,
      );
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Public helpers exposed for direct use by discovery services        */
  /* ------------------------------------------------------------------ */

  /**
   * Delete a single Redis key directly.  Used when the service knows the
   * exact key (e.g. after updating partner_of_week_ids).
   */
  async deleteKey(key: string): Promise<number> {
    try {
      const deleted = await this.getRedis().del(key);
      if (deleted > 0) {
        this.logger.debug({ key }, 'Discovery cache key deleted');
      }
      return deleted;
    } catch (err) {
      this.logger.error(
        { key, error: (err as Error).message },
        'Discovery cache key delete failed',
      );
      return 0;
    }
  }

  /**
   * Delete all keys matching a glob pattern using SCAN + pipeline DEL.
   * Safe for production -- never uses KEYS.
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const redis = this.getRedis();
    let cursor = '0';
    let deleted = 0;
    try {
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== '0');
      if (deleted > 0) {
        this.logger.info(
          { pattern, deleted },
          'Discovery bulk cache invalidation',
        );
      }
    } catch (err) {
      this.logger.error(
        { pattern, error: (err as Error).message },
        'Discovery bulk cache invalidation failed',
      );
    }
    return deleted;
  }

  /**
   * Build a user-scoped cache key for a discovery endpoint.
   *
   * Format: `discovery:{endpoint}:user:{userId}:{hash}`
   */
  buildUserCacheKey(endpoint: string, userId: string, hash: string): string {
    return `discovery:${endpoint}:user:${userId}:${hash}`;
  }
}
