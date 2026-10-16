import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type Redis from 'ioredis-v6';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Cache key patterns maintained for the Video Classrooms module.
 *
 * These prefixes mirror the cache keys written by video-call operations
 * (room lists, room details, participant rosters, recordings) that must be
 * invalidated when room state mutates.
 */
const VIDEO_CLASSROOM_CACHE_PATTERNS = [
  // Room list caches (by language pair, topic, or global)
  'video:classroom:list:*',

  // Individual room detail / state caches
  'video:classroom:room:*',

  // Participant roster caches per room
  'video:classroom:participants:*',

  // Recording / egress metadata caches
  'video:classroom:recording:*',

  // Host dashboard caches that include video classroom data
  'host:dashboard:active:video_rooms',
] as const;

const SCAN_BATCH_SIZE = 500;

/**
 * Cache invalidation triggers fired by video-classroom events.
 */
export enum VideoClassroomCacheInvalidationTrigger {
  /** Room created or terminated. */
  ROOM_MUTATED = 'video.room_mutated',
  /** Participant joined or left. */
  PARTICIPANT_MUTATED = 'video.participant_mutated',
  /** Recording started, stopped, or archived. */
  RECORDING_MUTATED = 'video.recording_mutated',
}

@Injectable()
export class VideoCallsCacheInvalidationService {
  private readonly logger = new Logger(VideoCallsCacheInvalidationService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  /**
   * Invalidate all caches affected by a video classroom mutation (create / terminate / reconfigure).
   */
  async invalidateRoomCaches(roomId?: string): Promise<void> {
    const redis = this.getRedis();
    try {
      let totalDeleted = 0;

      if (roomId) {
        // Surgical invalidation for a specific room
        const targeted = [
          `video:classroom:room:${roomId}`,
          `video:classroom:participants:${roomId}`,
          `video:classroom:recording:${roomId}`,
        ];
        totalDeleted += await redis.del(...targeted);
      }

      // Always invalidate room lists (any mutation changes the list)
      totalDeleted += await this.deleteByScan(redis, 'video:classroom:list');

      // Also purge the host-dashboard aggregate
      const deletedDashboardKeys = await redis.del(
        'host:dashboard:active:video_rooms',
      );
      totalDeleted += deletedDashboardKeys;

      if (totalDeleted > 0) {
        this.logger.log(
          `Invalidated ${totalDeleted} video-classroom cache key(s) after room mutation` +
            (roomId ? ` (room ${roomId})` : ''),
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to invalidate video-classroom room caches',
        err,
      );
    }
  }

  /**
   * Invalidate participant rosters for a specific room.
   */
  async invalidateParticipantCaches(roomId: string): Promise<void> {
    const redis = this.getRedis();
    try {
      const keys = [
        `video:classroom:participants:${roomId}`,
        `video:classroom:room:${roomId}`,
      ];
      const deleted = await redis.del(...keys);
      if (deleted > 0) {
        this.logger.log(
          `Invalidated ${deleted} participant cache key(s) for room ${roomId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to invalidate participant caches for room ${roomId}`,
        err,
      );
    }
  }

  /**
   * Invalidate recording metadata caches for a specific room.
   */
  async invalidateRecordingCaches(roomId: string): Promise<void> {
    const redis = this.getRedis();
    try {
      const keys = [
        `video:classroom:recording:${roomId}`,
        `video:classroom:room:${roomId}`,
      ];
      const deleted = await redis.del(...keys);
      if (deleted > 0) {
        this.logger.log(
          `Invalidated ${deleted} recording cache key(s) for room ${roomId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to invalidate recording caches for room ${roomId}`,
        err,
      );
    }
  }

  /**
   * Bulk-invalidate every video-classroom cache entry (used for admin data clears).
   */
  async invalidateAllVideoClassroomCaches(): Promise<void> {
    const redis = this.getRedis();
    try {
      let totalDeleted = 0;

      for (const pattern of VIDEO_CLASSROOM_CACHE_PATTERNS) {
        if (pattern.endsWith(':*')) {
          const prefix = pattern.slice(0, -2);
          totalDeleted += await this.deleteByScan(redis, prefix);
        } else {
          totalDeleted += await redis.del(pattern);
        }
      }

      if (totalDeleted > 0) {
        this.logger.log(
          `Bulk-invalidated ${totalDeleted} video-classroom cache key(s)`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Failed to bulk-invalidate video-classroom caches',
        err,
      );
    }
  }

  // ----- Event-driven invalidation -----

  @OnEvent(VideoClassroomCacheInvalidationTrigger.ROOM_MUTATED, { async: true })
  async handleRoomMutated(payload: { roomId?: string }): Promise<void> {
    await this.invalidateRoomCaches(payload.roomId);
  }

  @OnEvent(VideoClassroomCacheInvalidationTrigger.PARTICIPANT_MUTATED, {
    async: true,
  })
  async handleParticipantMutated(payload: { roomId: string }): Promise<void> {
    await this.invalidateParticipantCaches(payload.roomId);
  }

  @OnEvent(VideoClassroomCacheInvalidationTrigger.RECORDING_MUTATED, {
    async: true,
  })
  async handleRecordingMutated(payload: { roomId: string }): Promise<void> {
    await this.invalidateRecordingCaches(payload.roomId);
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
