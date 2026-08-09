import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Resets study_streak_days to 0 for users who have been inactive
   * for more than 24 hours. Returns the number of users whose streaks
   * were reset.
   */
  async resetStreaksForInactiveUsers(): Promise<number> {
    const supabase = this.supabaseService.getClient();

    // Calculate the cutoff time (24 hours ago)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Query users whose last_active_at is older than the cutoff
    // OR last_active_at is NULL (never active)
    // and who still have a streak > 0
    const { data: inactiveUsers, error: queryError } = await supabase
      .from('users')
      .select('id, study_streak_days, last_active_at')
      .or(`last_active_at.lt.${cutoff},last_active_at.is.null`)
      .gt('study_streak_days', 0);

    if (queryError) {
      this.logger.error('Failed to query inactive users', queryError.message);
      return 0;
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      this.logger.log('No inactive users found for streak reset');
      return 0;
    }

    const userIds: string[] = inactiveUsers.map(
      (user: { id: string }) => user.id,
    );

    // Reset streaks for the found users
    const { error: updateError } = await supabase
      .from('users')
      .update({ study_streak_days: 0 })
      .in('id', userIds);

    if (updateError) {
      this.logger.error('Failed to reset streaks', updateError.message);
      return 0;
    }

    this.logger.log(`Reset streaks for ${userIds.length} inactive users`);
    return userIds.length;
  }

  /**
   * Convenience method for automated tests that resets streaks for
   * inactive users. Calls the shared business logic directly.
   */
  async resetStreaksForTesting(): Promise<number> {
    return this.resetStreaksForInactiveUsers();
  }

  /**
   * Scheduled job that runs daily at midnight to reset streaks for inactive users.
   */
  @Cron('0 0 * * *')
  async handleStreakResetCron(): Promise<void> {
    this.logger.log('Running scheduled streak reset job');
    try {
      const resetCount = await this.resetStreaksForInactiveUsers();
      if (resetCount > 0) {
        this.logger.log(`Successfully reset ${resetCount} user streaks`);
      }
    } catch (error) {
      this.logger.error('Streak reset cron job failed', error);
    }
  }
}
