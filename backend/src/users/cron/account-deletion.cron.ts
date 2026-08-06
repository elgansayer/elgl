import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import { UsersService } from '../users.service';

interface DeletableUser {
  id: string;
}

@Injectable()
export class AccountDeletionCron {
  private readonly logger = new Logger(AccountDeletionCron.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAccountDeletions(): Promise<void> {
    this.logger.log('Running account deletion cron job...');
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    try {
      const { data: usersToDelete, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .not('scheduled_for_deletion_at', 'is', null)
        .lte('scheduled_for_deletion_at', now)
        .returns<DeletableUser[]>();

      if (fetchError) {
        this.logger.error('Failed to fetch users for deletion', fetchError);
        return;
      }

      if (!usersToDelete || usersToDelete.length === 0) {
        this.logger.log('No accounts pending deletion past the grace period.');
        return;
      }

      this.logger.log(`Found ${usersToDelete.length} accounts to delete.`);

      for (const user of usersToDelete) {
        try {
          await this.usersService.permanentDeleteAccount(String(user.id));
          this.logger.log(`Successfully deleted user ${user.id}`);
        } catch (err) {
          this.logger.error(
            `Failed to delete user ${user.id}: ${(err as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Unexpected error during account deletion cron',
        error,
      );
    }
  }
}
