import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StreakService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async updateStreak(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    // Fetch current streak days and last streak date
    const { data: user, error } = await supabase
      .from('users')
      .select('study_streak_days, last_streak_date')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new InternalServerErrorException('Failed to fetch user streak data');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    let newStreak: number;
    let newLastDate: string;

    if (!user.last_streak_date) {
      // No previous activity, start streak at 1
      newStreak = 1;
      newLastDate = todayStr;
    } else {
      const lastDate = new Date(user.last_streak_date);
      lastDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor(
        (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays === 0) {
        // Already updated today, keep current streak
        newStreak = user.study_streak_days;
        newLastDate = todayStr;
      } else if (diffDays === 1) {
        // Consecutive day, increment
        newStreak = user.study_streak_days + 1;
        newLastDate = todayStr;
      } else {
        // Gap >1 day, reset
        newStreak = 1;
        newLastDate = todayStr;
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        study_streak_days: newStreak,
        last_streak_date: newLastDate,
      })
      .eq('id', userId);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update streak');
    }

    return newStreak;
  }

  async getStreak(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('study_streak_days')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new InternalServerErrorException('Failed to fetch streak');
    }

    return user.study_streak_days;
  }
}
