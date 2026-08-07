import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class ScheduledDeletionService {
  private readonly logger = new Logger(ScheduledDeletionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processScheduledDeletions(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .lte('scheduled_for_deletion_at', now);

    if (error) {
      this.logger.error(
        `Failed to query scheduled deletions: ${error.message}`,
      );
      return;
    }

    if (!data || data.length === 0) {
      this.logger.log('No accounts scheduled for deletion today');
      return;
    }

    for (const user of data) {
      try {
        await this.usersService.permanentDeleteAccount(user.id);
        this.logger.log(`Permanently deleted user: ${user.id}`);
      } catch (err) {
        this.logger.error(
          `Error deleting user ${user.id}: ${(err as Error).message}`,
        );
      }
    }
  }
}
