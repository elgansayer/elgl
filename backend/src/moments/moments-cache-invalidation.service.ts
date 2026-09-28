import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

type RedisClient = ReturnType<SupabaseService['getRedisClient']>;

interface FollowGraphEvent {
  followerId: string;
}

interface MomentRemovedEvent {
  momentId: string;
}

export enum MomentsCacheInvalidationTrigger {
  USER_FOLLOWED = 'user.followed',
  USER_UNFOLLOWED = 'user.unfollowed',
  MOMENT_REMOVED = 'moments.moment_removed',
  TIMELINE_RESET = 'moments.timeline_reset',
}

export interface MomentsCacheInvalidationRule {
  readonly trigger: MomentsCacheInvalidationTrigger;
  readonly pattern: string;
  readonly action: 'delete' | 'remove-moment';
  readonly description: string;
}

const TIMELINE_QUEUE_PATTERN = 'timeline_queue:*';
const SCAN_BATCH_SIZE = 100;

/**
 * Centralised invalidation rules for the Redis-backed Moments timeline index.
 *
 * Moments payloads are read from Supabase. Redis currently stores only the
 * per-user following timeline of Moment IDs, so invalidation deliberately
 * targets that read model instead of inventing a second payload cache.
 */
@Injectable()
export class MomentsCacheInvalidationService {
  private readonly logger = new Logger(MomentsCacheInvalidationService.name);

  readonly rules: ReadonlyArray<MomentsCacheInvalidationRule> = [
    {
      trigger: MomentsCacheInvalidationTrigger.USER_FOLLOWED,
      pattern: 'timeline_queue:{followerId}',
      action: 'delete',
      description:
        'Rebuild a follower timeline after the following graph changes.',
    },
    {
      trigger: MomentsCacheInvalidationTrigger.USER_UNFOLLOWED,
      pattern: 'timeline_queue:{followerId}',
      action: 'delete',
      description:
        'Remove cached membership from a follower timeline after unfollowing.',
    },
    {
      trigger: MomentsCacheInvalidationTrigger.MOMENT_REMOVED,
      pattern: TIMELINE_QUEUE_PATTERN,
      action: 'remove-moment',
      description:
        'Remove a deleted or withdrawn Moment ID from every cached timeline.',
    },
    {
      trigger: MomentsCacheInvalidationTrigger.TIMELINE_RESET,
      pattern: TIMELINE_QUEUE_PATTERN,
      action: 'delete',
      description:
        'Clear all Moments timeline indexes during an explicit reset.',
    },
  ];

  constructor(private readonly supabaseService: SupabaseService) {}

  @OnEvent(MomentsCacheInvalidationTrigger.USER_FOLLOWED, { async: true })
  async handleUserFollowed(payload: FollowGraphEvent): Promise<void> {
    await this.invalidateUserTimeline(payload.followerId);
  }

  @OnEvent(MomentsCacheInvalidationTrigger.USER_UNFOLLOWED, { async: true })
  async handleUserUnfollowed(payload: FollowGraphEvent): Promise<void> {
    await this.invalidateUserTimeline(payload.followerId);
  }

  @OnEvent(MomentsCacheInvalidationTrigger.MOMENT_REMOVED, { async: true })
  async handleMomentRemoved(payload: MomentRemovedEvent): Promise<void> {
    await this.removeMomentFromAllTimelines(payload.momentId);
  }

  @OnEvent(MomentsCacheInvalidationTrigger.TIMELINE_RESET, { async: true })
  async handleTimelineReset(): Promise<void> {
    await this.invalidateAllTimelines();
  }

  async invalidateUserTimeline(userId: string): Promise<number> {
    try {
      const deleted = await this.getRedis().del(this.timelineKey(userId));
      if (deleted > 0) {
        this.logger.log('Invalidated one Moments timeline cache.');
      }
      return deleted;
    } catch (error: unknown) {
      this.logFailure('user timeline invalidation', error);
      return 0;
    }
  }

  async removeMomentFromAllTimelines(momentId: string): Promise<number> {
    const redis = this.getRedis();
    let removed = 0;

    try {
      await this.scanTimelineKeys(redis, async (keys) => {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.lrem(key, 0, momentId);
        }

        const results = await pipeline.exec();
        for (const result of results ?? []) {
          const [commandError, value] = result;
          if (!commandError && typeof value === 'number') {
            removed += value;
          }
        }
      });

      if (removed > 0) {
        this.logger.log(
          `Removed a withdrawn Moment from ${removed} cached timeline entr${removed === 1 ? 'y' : 'ies'}.`,
        );
      }
      return removed;
    } catch (error: unknown) {
      this.logFailure('Moment removal cache invalidation', error);
      return removed;
    }
  }

  async invalidateAllTimelines(): Promise<number> {
    const redis = this.getRedis();
    let deleted = 0;

    try {
      await this.scanTimelineKeys(redis, async (keys) => {
        deleted += await redis.del(...keys);
      });

      if (deleted > 0) {
        this.logger.log(
          `Invalidated ${deleted} Moments timeline cache key(s).`,
        );
      }
      return deleted;
    } catch (error: unknown) {
      this.logFailure('bulk timeline invalidation', error);
      return deleted;
    }
  }

  private getRedis(): RedisClient {
    return this.supabaseService.getRedisClient();
  }

  private timelineKey(userId: string): string {
    return `timeline_queue:${userId}`;
  }

  private async scanTimelineKeys(
    redis: RedisClient,
    onKeys: (keys: string[]) => Promise<void>,
  ): Promise<void> {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        TIMELINE_QUEUE_PATTERN,
        'COUNT',
        SCAN_BATCH_SIZE,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await onKeys(keys);
      }
    } while (cursor !== '0');
  }

  private logFailure(operation: string, error: unknown): void {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    this.logger.error(`Moments ${operation} failed (${errorName}).`);
  }
}
