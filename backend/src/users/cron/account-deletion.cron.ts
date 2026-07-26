import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class AccountDeletionCron {
  private readonly logger = new Logger(AccountDeletionCron.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAccountDeletions() {
    this.logger.log('Running account deletion cron job...');
    const supabase = this.supabaseService.getClient();
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      // Find users whose deletion request is older than 30 days
      const { data: usersToDelete, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .not('deletion_requested_at', 'is', null)
        .lt('deletion_requested_at', thirtyDaysAgo.toISOString());

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
        // Delete from auth.users (this cascades to the public.users table if foreign keys are set up correctly)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          this.logger.error(`Failed to delete user ${user.id}`, deleteError);
        } else {
          this.logger.log(`Successfully deleted user ${user.id}`);
        }
      }
    } catch (error) {
      this.logger.error('Unexpected error during account deletion cron', error);
    }
  }
}
