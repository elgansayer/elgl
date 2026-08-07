import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import { ProfileUpdatedEvent } from '../notifications/events/notification.events';

/**
 * Cache key prefixes maintained by the Matchmaking Algorithm module.
 * These prefixes mirror the cache keys written by DiscoveryService and
 * RecommendationsService that must be invalidated when user profiles
 * (languages, interests, privacy, proficiency, streaks) are updated.
 */
const MATCHMAKING_AFFECTED_CACHE_PATTERNS = [
  // Discovery caches (discovery.service.ts)
  'partner_of_week_ids',

  // Recommendations caches (recommendations.service.ts)
  'recommendations:daily:',
  'daily_recommendations:',
] as const;

/**
 * Profile fields that, when changed, require invalidation of per-user
 * matchmaking caches (daily_recommendations:* and recommendations:daily:*).
 */
const MATCHMAKING_SENSITIVE_FIELDS = new Set([
  'native_languages',
  'target_languages',
  'interests',
  'learning_goals',
  'proficiency_level',
  'privacy_hide_from_search',
  'privacy_hide_location',
  'privacy_hide_exact_location',
  'location',
  'mock_location',
  'mock_country',
  'mock_city',
  'study_streak_days',
  'correction_ratio',
  'is_serious_learner',
  'serious_learner_mode',
  'gender',
  'age',
  'country',
  'city',
]);

/**
 * Profile fields that, when changed, should trigger a global Partner of
 * the Week cache invalidation because they affect the leaderboard.
 */
const LEADERBOARD_SENSITIVE_FIELDS = new Set([
  'correction_ratio',
  'study_streak_days',
  'is_serious_learner',
]);

const SCAN_BATCH_SIZE = 500;

@Injectable()
export class MatchmakingCacheInvalidationService {
  private readonly logger = new Logger(
    MatchmakingCacheInvalidationService.name,
  );

  constructor(private readonly supabaseService: SupabaseService) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  /**
   * Auto-invalidate matchmaking caches when a user profile is updated.
   * Only invalidates if the changed fields actually affect matchmaking.
   */
  @OnEvent('profile.updated')
  async handleProfileUpdated(event: ProfileUpdatedEvent): Promise<void> {
    const { userId, changedFields } = event;

    const hasMatchmakingSensitiveChange = changedFields.some((field) =>
      MATCHMAKING_SENSITIVE_FIELDS.has(field),
    );

    if (!hasMatchmakingSensitiveChange) {
      this.logger.log(
        `Profile update for user ${userId} did not affect matchmaking fields; skipping invalidation`,
      );
      return;
    }

    await this.invalidateUserMatchmakingCaches(userId);

    const hasLeaderboardChange = changedFields.some((field) =>
      LEADERBOARD_SENSITIVE_FIELDS.has(field),
    );

    if (hasLeaderboardChange) {
      await this.invalidatePartnerOfWeekCache();
    }
  }

  /**
   * Invalidate all matchmaking caches for a specific user after a profile
   * update that affects matching (languages, interests, privacy, proficiency,
   * study streaks, location, etc.).
   */
  async invalidateUserMatchmakingCaches(userId: string): Promise<void> {
    const redis = this.getRedis();
    try {
      const keysToDelete = [
        `daily_recommendations:${userId}`,
        `recommendations:daily:${userId}`,
      ];

      const deleted = await redis.del(...keysToDelete);
      if (deleted > 0) {
        this.logger.log(
          `Invalidated ${deleted} matchmaking cache key(s) for user ${userId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to invalidate matchmaking caches for user ${userId}`,
        err,
      );
    }
  }

  /**
   * Invalidate the global Partner of the Week cache.
   * Should be called when a user's correction_ratio or study_streak
   * changes significantly enough to potentially affect the leaderboard.
   */
  async invalidatePartnerOfWeekCache(): Promise<void> {
    const redis = this.getRedis();
    try {
      const deleted = await redis.del('partner_of_week_ids');
      if (deleted > 0) {
        this.logger.log('Invalidated global partner_of_week_ids cache');
      }
    } catch (err) {
      this.logger.error('Failed to invalidate partner_of_week_ids cache', err);
    }
  }

  /**
   * Full invalidation of all matchmaking caches (sweep).
   * Used after bulk operations such as admin user changes.
   */
  async invalidateAllMatchmakingCaches(): Promise<void> {
    const redis = this.getRedis();
    try {
      let totalDeleted = 0;

      for (const pattern of MATCHMAKING_AFFECTED_CACHE_PATTERNS) {
        if (pattern.endsWith(':')) {
          const deleted = await this.deleteByScan(redis, pattern);
          totalDeleted += deleted;
        } else {
          const deleted = await redis.del(pattern);
          totalDeleted += deleted;
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Invalidated ${totalDeleted} matchmaking cache key(s) during full sweep`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to invalidate all matchmaking caches', err);
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
}
