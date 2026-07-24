import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class StreakResetCron {
  private readonly logger = new Logger(StreakResetCron.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Runs every day at midnight.
   * Resets `study_streak_days` to 0 for users whose `last_active_at`
   * is older than 24 hours and whose streak is not already 0.
   *
   * NOTE: This assumes a `last_active_at` column exists in the `users` table.
   * If the column does not exist, the query will fail silently (Supabase returns
   * an error). Adjust the column name or logic as needed.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleStreakReset(): Promise<void> {
    this.logger.log('Running streak reset cron job...');

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { error } = await this.supabase
      .getClient()
      .from('users')
      .update({ study_streak_days: 0 })
      .lt('last_active_at', yesterday.toISOString())
      .neq('study_streak_days', 0);

    if (error) {
      this.logger.error('Failed to reset streaks', error);
    } else {
      this.logger.log('Streak reset completed successfully');
    }
  }
}
