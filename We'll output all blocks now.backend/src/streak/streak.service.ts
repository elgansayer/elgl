import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron('0 0 * * *')
  async resetInactiveStreaks(): Promise<void> {
    this.logger.log('Starting daily streak reset for inactive users...');

    const supabase = this.supabaseService.getClient();

    // Calculate cutoff: 24 hours ago from now
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find users whose study_streak_days > 0 and last_active_at is older than 24 hours
    const { data: inactiveUsers, error: queryError } = await supabase
      .from('users')
      .select('id, study_streak_days, last_active_at')
      .gt('study_streak_days', 0)
      .lt('last_active_at', cutoffTime);

    if (queryError) {
      this.logger.error(`Failed to query inactive users: ${queryError.message}`);
      return;
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      this.logger.log('No inactive users found to reset.');
      return;
    }

    const userIds = inactiveUsers.map((user) => user.id);

    // Reset study_streak_days to 0 for all inactive users
    const { error: updateError } = await supabase
      .from('users')
      .update({ study_streak_days: 0 })
      .in('id', userIds);

    if (updateError) {
      this.logger.error(`Failed to reset streaks: ${updateError.message}`);
      return;
    }

    this.logger.log(`Successfully reset streaks for ${userIds.length} inactive users.`);
  }

  // Exposed for unit testing
  async resetStreaksForTesting(): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: inactiveUsers, error: queryError } = await supabase
      .from('users')
      .select('id')
      .gt('study_streak_days', 0)
      .lt('last_active_at', cutoffTime);

    if (queryError || !inactiveUsers) {
      return 0;
    }

    const userIds = inactiveUsers.map((u) => u.id);
    if (userIds.length === 0) return 0;

    const { error: updateError } = await supabase
      .from('users')
      .update({ study_streak_days: 0 })
      .in('id', userIds);

    if (updateError) return 0;
    return userIds.length;
  }
}
