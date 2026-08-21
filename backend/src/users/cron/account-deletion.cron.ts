import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseClient } from '@supabase/supabase-js';
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
  async handleAccountDeletions() {
    this.logger.log('Running account deletion cron job...');
    const supabase: SupabaseClient = this.supabaseService.getClient();
    const now = new Date().toISOString();

    try {
      // Find users whose scheduled deletion date has passed (30-day grace expired)
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

      // ⚡ Bolt Optimization: Use chunked concurrency to process deletions efficiently without overwhelming the connection pool
      const chunkSize = 5;
      for (let i = 0; i < usersToDelete.length; i += chunkSize) {
        const chunk = usersToDelete.slice(i, i + chunkSize);

        const deletionPromises = chunk.map((user) =>
          this.usersService
            .permanentDeleteAccount(String(user.id))
            .then(() => {
              this.logger.log(`Successfully deleted user ${user.id}`);
              return { id: user.id, success: true as const, error: undefined };
            })
            .catch((error) => {
              return {
                id: user.id,
                success: false as const,
                error: (error as Error).message,
              };
            }),
        );

        const results = await Promise.all(deletionPromises);

        for (const result of results) {
          if (!result.success && result.error) {
            this.logger.error(
              `Failed to delete user ${result.id}: ${result.error}`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Unexpected error during account deletion cron', error);
    }
  }
}
