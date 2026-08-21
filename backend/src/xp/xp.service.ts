import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

type XpActivityType =
  | 'create_flashcard'
  | 'review_flashcard'
  | 'complete_lesson'
  | 'create_moment'
  | 'follow_language_partner';

const ACTIVITY_POINTS: Record<XpActivityType, number> = {
  create_flashcard: 5,
  review_flashcard: 2,
  complete_lesson: 10,
  create_moment: 3,
  follow_language_partner: 2,
};

type XpEventRecord = {
  id: string;
  user_id: string;
  points: number;
  activity: string;
  created_at: string;
};

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);
  constructor(private readonly supabaseService: SupabaseService) {}

  async awardXpForActivity(userId: string, activity: string): Promise<void> {
    const points = ACTIVITY_POINTS[activity as XpActivityType] ?? 0;
    if (points <= 0) {
      return;
    }
    await this.supabaseService.incrementXp(userId, points);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('xp_events').insert({
      user_id: userId,
      points,
      activity,
      created_at: new Date().toISOString(),
    });
    if (error) {
      this.logger.warn(
        `Failed to log XP event for user ${userId}: ${error.message}`,
      );
    }
  }

  async getTotalXp(userId: string): Promise<number> {
    return this.supabaseService.getUserXp(userId);
  }

  async getXpTotal(userId: string): Promise<number> {
    return this.getTotalXp(userId);
  }

  async getXpHistory(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<XpEventRecord[]> {
    const supabase = this.supabaseService.getClient();
    const response = await supabase
      .from('xp_events')
      .select('id, user_id, points, activity, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (response.error) {
      throw new InternalServerErrorException('Failed to fetch XP history');
    }

    return response.data ?? [];
  }

  getActivityPoints(): Record<string, number> {
    return { ...ACTIVITY_POINTS };
  }

  getPointsForActivity(activity: string): number {
    return ACTIVITY_POINTS[activity as XpActivityType] ?? 0;
  }

  async awardXp(userId: string, reason: string, points = 0): Promise<void> {
    if (points <= 0) {
      return;
    }
    await this.supabaseService.incrementXp(userId, points);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('xp_events').insert({
      user_id: userId,
      points,
      activity: reason,
      created_at: new Date().toISOString(),
    });
    if (error) {
      this.logger.warn(
        `Failed to log XP event for user ${userId}: ${error.message}`,
      );
    }
  }

  async getLevel(userId: string): Promise<number> {
    const xpTotal = await this.getTotalXp(userId);
    return Math.floor(xpTotal / 100) + 1;
  }
}
