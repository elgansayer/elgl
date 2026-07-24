import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class StreakResetCron {
  private readonly logger = new Logger(StreakResetCron.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async resetInactiveStreaks(): Promise<void> {
    this.logger.log('Starting streak reset check for inactive users...');

    const supabase = this.supabaseService.getClient();

    // Calculate the cutoff: 24 hours ago from now
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find users whose study_streak_days > 0 and last activity was more than 24 hours ago
    // We check against created_at as a proxy for last activity (since we don't have a last_active_at column)
    // In production, you'd use a proper last_active_at timestamp
    const { data: usersToReset, error: fetchError } = await supabase
      .from('users')
      .select('id, study_streak_days, created_at')
      .gt('study_streak_days', 0)
      .lt('created_at', cutoffTime);

    if (fetchError) {
      this.logger.error(`Failed to fetch users for streak reset: ${fetchError.message}`);
      return;
    }

    if (!usersToReset || usersToReset.length === 0) {
      this.logger.log('No users need streak reset at this time.');
      return;
    }

    this.logger.log(`Found ${usersToReset.length} users with expired streaks. Resetting...`);

    // Reset streaks to 0 for all inactive users
    const userIds = usersToReset.map(user => user.id);

    const { error: updateError } = await supabase
      .from('users')
      .update({ study_streak_days: 0 })
      .in('id', userIds);

    if (updateError) {
      this.logger.error(`Failed to reset streaks: ${updateError.message}`);
      return;
    }

    this.logger.log(`Successfully reset streaks for ${userIds.length} users.`);
  }
}
