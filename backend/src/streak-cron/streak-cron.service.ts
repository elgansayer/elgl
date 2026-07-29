import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StreakCronService {
  private readonly logger = new Logger(StreakCronService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async resetInactiveStreaks(): Promise<void> {
    const twentyFourHoursAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await this.supabaseService
      .getClient()
      .from('users')
      .update({ study_streak_days: 0 })
      .lt('last_active_at', twentyFourHoursAgo);

    if (error) {
      this.logger.error(`Failed to reset streaks: ${error.message}`, error);
    } else {
      this.logger.warn(
        `Reset streaks for users inactive since ${twentyFourHoursAgo}`,
      );
    }
  }
}
