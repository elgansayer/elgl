import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable({ providedIn: 'root' })
export class XpService {
  private readonly logger = new Logger(XpService.name);

  private readonly pointMap: Record<string, number> = {
    send_message: 1,
    create_flashcard: 5,
    review_flashcard: 2,
    create_moment: 10,
    add_comment: 2,
    complete_assessment: 20,
  };

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Award XP points to a user for a learning activity.
   */
  async awardXp(
    userId: string,
    reason: string,
    points: number = 0,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    // Read current XP total
    const { data: user } = await supabase
      .from('users')
      .select('xp_total')
      .eq('id', userId)
      .single();

    const currentXp = (user as { xp_total?: number })?.xp_total ?? 0;
    const newXp = currentXp + points;

    const { error } = await supabase
      .from('users')
      .update({ xp_total: newXp })
      .eq('id', userId);

    if (error) {
      this.logger.warn(`Failed to award XP to ${userId}: ${error.message}`);
    }
  }

  /**
   * Convenience method that looks up the point value from the internal map.
   */
  async awardXpForActivity(userId: string, reason: string): Promise<void> {
    const points = this.pointMap[reason];
    if (points === undefined) {
      this.logger.warn(`Unknown XP reason "${reason}", no points awarded`);
      return;
    }
    await this.awardXp(userId, reason, points);
  }

  async getXpTotal(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('xp_total')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return 0;
    }
    return (data as { xp_total?: number }).xp_total ?? 0;
  }

  /**
   * Compute user level based on thresholds (every 100 XP).
   */
  async getLevel(userId: string): Promise<number> {
    const xpTotal = await this.getXpTotal(userId);
    // level 1 at 0 XP, level 2 at 100, etc.
    return Math.floor(xpTotal / 100) + 1;
  }
}
