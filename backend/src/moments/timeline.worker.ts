import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface UserFollowRow {
  follower_id: string;
}

@Injectable()
export class TimelineWorker {
  private readonly logger = new Logger(TimelineWorker.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async fanOutMoment(momentId: string, authorId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const redis = this.supabaseService.getRedisClient();

      // Query all followers of author
      const { data: follows, error } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', authorId);

      if (error || !follows) {
        return;
      }

      const rows = follows as UserFollowRow[];
      const followerIds = new Set<string>(rows.map((f) => f.follower_id));
      followerIds.add(authorId);

      // Fan out via Redis pipeline to reduce network roundtrips
      const pipeline = redis.pipeline();
      for (const followerId of followerIds) {
        const queueKey = `timeline_queue:${followerId}`;
        pipeline.lpush(queueKey, momentId);
        pipeline.ltrim(queueKey, 0, 499); // Keep latest 500 IDs
      }
      await pipeline.exec();

      this.logger.log(
        `Fanned out moment ${momentId} to ${followerIds.size} followers via Redis queue.`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Failed to fan-out moment ${momentId}: ${msg}`);
    }
  }
}
