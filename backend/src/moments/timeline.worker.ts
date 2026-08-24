import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface UserFollowRow {
  follower_id: string;
}

type RedisClient = ReturnType<SupabaseService['getRedisClient']>;
type SupabaseClient = ReturnType<SupabaseService['getClient']>;

class TimelineFollowerLookupError extends Error {
  override readonly name = 'TimelineFollowerLookupError';
}

class TimelineQueueWriteError extends Error {
  override readonly name = 'TimelineQueueWriteError';
}

class TimelinePaginationError extends Error {
  override readonly name = 'TimelinePaginationError';
}

@Injectable()
export class TimelineWorker {
  private static readonly FOLLOWER_BATCH_SIZE = 500;
  private static readonly TIMELINE_QUEUE_MAX_LENGTH = 500;
  private static readonly MAX_ATTEMPTS = 2;

  private readonly logger = new Logger(TimelineWorker.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async fanOutMoment(momentId: string, authorId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const redis = this.supabaseService.getRedisClient();
      let followerCursor: string | null = null;
      let includeAuthor = true;
      let recipientCount = 0;

      while (true) {
        const rows = await this.loadFollowerBatch(
          supabase,
          authorId,
          followerCursor,
        );
        const recipientIds = new Set<string>(
          rows
            .map((follow) => follow.follower_id)
            .filter((id): id is string => Boolean(id) && id !== authorId),
        );

        if (includeAuthor) {
          recipientIds.add(authorId);
          includeAuthor = false;
        }

        if (recipientIds.size > 0) {
          await this.enqueueRecipients(redis, [...recipientIds], momentId);
          recipientCount += recipientIds.size;
        }

        if (rows.length < TimelineWorker.FOLLOWER_BATCH_SIZE) {
          break;
        }

        const nextCursor = rows.at(-1)?.follower_id;
        if (!nextCursor || nextCursor === followerCursor) {
          throw new TimelinePaginationError();
        }
        followerCursor = nextCursor;
      }

      this.logger.log(
        `Timeline fan-out completed for ${recipientCount} recipients.`,
      );
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.error(`Timeline fan-out failed (${errorName}).`);
    }
  }

  private async loadFollowerBatch(
    supabase: SupabaseClient,
    authorId: string,
    afterFollowerId: string | null,
  ): Promise<UserFollowRow[]> {
    for (let attempt = 1; attempt <= TimelineWorker.MAX_ATTEMPTS; attempt++) {
      try {
        let query = supabase
          .from('user_follows')
          .select('follower_id')
          .eq('following_id', authorId)
          .order('follower_id', { ascending: true })
          .limit(TimelineWorker.FOLLOWER_BATCH_SIZE);

        if (afterFollowerId !== null) {
          query = query.gt('follower_id', afterFollowerId);
        }

        const { data, error } = await query;

        if (!error) {
          return data ?? [];
        }
      } catch {
        // Retry once below. Provider details are deliberately not logged.
      }
    }

    throw new TimelineFollowerLookupError();
  }

  private async enqueueRecipients(
    redis: RedisClient,
    recipientIds: string[],
    momentId: string,
  ): Promise<void> {
    for (let attempt = 1; attempt <= TimelineWorker.MAX_ATTEMPTS; attempt++) {
      try {
        const transaction = redis.multi();

        for (const recipientId of recipientIds) {
          const queueKey = `timeline_queue:${recipientId}`;

          // LREM makes retries idempotent. RPUSH satisfies the queue contract,
          // then LMOVE preserves the existing newest-first LRANGE consumer.
          transaction.lrem(queueKey, 0, momentId);
          transaction.rpush(queueKey, momentId);
          transaction.lmove(queueKey, queueKey, 'RIGHT', 'LEFT');
          transaction.ltrim(
            queueKey,
            0,
            TimelineWorker.TIMELINE_QUEUE_MAX_LENGTH - 1,
          );
        }

        const results = await transaction.exec();
        const succeeded =
          results !== null &&
          results.every(([commandError]) => commandError === null);

        if (succeeded) {
          return;
        }
      } catch {
        // Retry once below. Queue keys and provider details are not logged.
      }
    }

    throw new TimelineQueueWriteError();
  }
}
