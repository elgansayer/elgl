import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';

/** Redis cache key prefixes used by the matchmaking / discovery subsystem. */
const MATCHMAKING_CACHE_PATTERNS = {
  dailyRecommendationsPrefix: 'daily_recommendations:',
  recommendationsDailyPrefix: 'recommendations:daily:',
  partnerOfWeekKey: 'partner_of_week_ids',
} as const;

const SCAN_BATCH_SIZE = 100;

/**
 * Service responsible for invalidating Redis caches associated with the
 * matchmaking algorithm whenever user profile data that drives matching
 * (languages, interests, privacy flags, serious-learner status, etc.)
 * is mutated.
 *
 * ## Invalidation Rules
 *
 * | Trigger                          | Keys invalidated                            |
 * |----------------------------------|---------------------------------------------|
 * | Profile update (langs, privacy)  | `daily_recommendations:{userId}`            |
 * |                                  | `recommendations:daily:{userId}`            |
 * |                                  | `partner_of_week_ids`                       |
 * | Interests update                 | `daily_recommendations:{userId}`            |
 * |                                  | `recommendations:daily:{userId}`            |
 * | Block / unblock / report         | (handled by SafetyCacheInvalidationService) |
 *
 * The `partner_of_week_ids` key is a single global key that is recalculated
 * weekly. We invalidate it on relevant profile mutations so stale partner-of-
 * week flags are not served until the next cron run.
 */
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
   * Invalidate all matchmaking caches associated with a specific user.
   *
   * Called after profile updates that affect matching (native/target
   * languages, privacy flags, serious-learner status, study streak,
   * correction ratio, proficiency level).
   */
  async invalidateUserMatchmakingCaches(userId: string): Promise<void> {
    const redis = this.getRedis();
    try {
      const keys = [
        `${MATCHMAKING_CACHE_PATTERNS.dailyRecommendationsPrefix}${userId}`,
        `${MATCHMAKING_CACHE_PATTERNS.recommendationsDailyPrefix}${userId}`,
      ];
      const deleted = await redis.del(...keys);
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
   * Invalidate the global partner-of-week cache.
   *
   * Called when profile attributes that influence the Partner of the Week
   * algorithm change (correction_ratio, study_streak_days, is_serious_learner).
   */
  async invalidatePartnerOfWeekCache(): Promise<void> {
    const redis = this.getRedis();
    try {
      const deleted = await redis.del(
        MATCHMAKING_CACHE_PATTERNS.partnerOfWeekKey,
      );
      if (deleted > 0) {
        this.logger.log('Invalidated partner_of_week_ids cache');
      }
    } catch (err) {
      this.logger.error('Failed to invalidate partner_of_week_ids cache', err);
    }
  }

  /**
   * Full invalidation for a profile mutation that could affect partner-of-week
   * rankings as well as the user's own recommendation caches.
   */
  async invalidateAfterProfileUpdate(userId: string): Promise<void> {
    await Promise.all([
      this.invalidateUserMatchmakingCaches(userId),
      this.invalidatePartnerOfWeekCache(),
    ]);
  }

  /**
   * Invalidate the daily recommendation caches for a batch of users.
   * Used after the nightly cron job recalculates recommendations to clear
   * stale entries for users who were NOT recomputed (i.e. users who were
   * skipped because they have no language data, or who were excluded).
   *
   * The cron job sets new values for each user it processes; this method
   * ensures that any user whose recommendations were NOT refreshed (e.g.
   * because their profile changed between cron runs) does not serve stale
   * data indefinitely.
   *
   * When called with `allUsers` = true, it scans for ALL recommendation
   * keys and removes them (intended to reset the cache before the nightly
   * cron job populates fresh data).
   */
  async invalidateStaleRecommendationCaches(
    processedUserIds: string[],
  ): Promise<void> {
    const redis = this.getRedis();
    const processedSet = new Set(processedUserIds);

    try {
      // Scan all daily_recommendations:* keys
      let cursor = '0';
      const staleKeys: string[] = [];

      do {
        const [nextCursor, scannedKeys] = await redis.scan(
          cursor,
          'MATCH',
          `${MATCHMAKING_CACHE_PATTERNS.dailyRecommendationsPrefix}*`,
          'COUNT',
          SCAN_BATCH_SIZE,
        );
        cursor = nextCursor;
        for (const key of scannedKeys) {
          const uid = key.slice(
            MATCHMAKING_CACHE_PATTERNS.dailyRecommendationsPrefix.length,
          );
          if (!processedSet.has(uid)) {
            staleKeys.push(key);
          }
        }
      } while (cursor !== '0');

      // Also scan recommendations:daily:* keys
      cursor = '0';
      do {
        const [nextCursor, scannedKeys] = await redis.scan(
          cursor,
          'MATCH',
          `${MATCHMAKING_CACHE_PATTERNS.recommendationsDailyPrefix}*`,
          'COUNT',
          SCAN_BATCH_SIZE,
        );
        cursor = nextCursor;
        for (const key of scannedKeys) {
          const uid = key.slice(
            MATCHMAKING_CACHE_PATTERNS.recommendationsDailyPrefix.length,
          );
          if (!processedSet.has(uid)) {
            staleKeys.push(key);
          }
        }
      } while (cursor !== '0');

      if (staleKeys.length > 0) {
        const staleCount = await redis.del(...staleKeys);
        this.logger.log(
          `Invalidated ${staleCount} stale recommendation cache key(s) for users not processed in current cron run`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to invalidate stale recommendation caches',
        err,
      );
    }
  }
}
