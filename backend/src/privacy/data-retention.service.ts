import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Scheduled data-retention enforcement for GDPR compliance.
 *
 * Runs nightly to:
 * - Purge login_history rows older than 180 days.
 * - Purge reports older than 365 days that are in a terminal state.
 * - Purge terminal escrow_transactions (released/refunded/cancelled) older than
 *   365 days.
 * - Archive deleted user records past their grace period.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Purge login history older than 180 days.
   * Runs once per day at 03:00 UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeLoginHistory(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('login_history')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge login history: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} login history rows older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge terminal (approved/rejected) reports older than 365 days.
   * Runs once per day at 03:30 UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purgeOldReports' })
  async purgeOldReports(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('reports')
      .delete({ count: 'exact' })
      .in('status', ['approved', 'rejected'])
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge old reports: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} terminal reports older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge terminal escrow transactions (released / refunded / cancelled)
   * older than 365 days. Runs once per day at 03:15 UTC.
   *
   * GDPR data-minimisation principle: settled escrow records older than one
   * year no longer serve a legitimate business or legal purpose for the
   * majority of jurisdictions.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purgeOldEscrows' })
  async purgeOldEscrows(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('escrow_transactions')
      .delete({ count: 'exact' })
      .in('status', ['released', 'refunded', 'cancelled'])
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge old escrow transactions: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} terminal escrow transactions older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Finalise deletion of user accounts past their 30-day grace period.
   * Runs once per day at 04:00 UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async finaliseAccountDeletions(): Promise<void> {
    const now = new Date();
    const supabase = this.supabaseService.getClient();

    // Find users whose scheduled deletion date has passed
    const { data: usersToDelete, error } = await supabase
      .from('users')
      .select('id')
      .eq('is_deletion_pending', true)
      .lt('scheduled_for_deletion_at', now.toISOString())
      .limit(100);

    if (error) {
      this.logger.error(
        `Failed to query users for deletion finalisation: ${error.message}`,
      );
      return;
    }

    if (!usersToDelete || usersToDelete.length === 0) {
      return;
    }

    for (const user of usersToDelete) {
      const userId = (user as { id: string }).id;
      try {
        // Delete user's personal data from all tables
        await this.wipeUserData(userId);
        // Anonymise the user row instead of deleting it (to keep referential integrity)
        const { error: anonymiseError } = await supabase
          .from('users')
          .update({
            display_name: `deleted_user_${userId.substring(0, 8)}`,
            avatar_url: null,
            audio_intro_url: null,
            bio_text: null,
            status_text: null,
            greeting_message: null,
            away_message: null,
            native_language: null,
            target_languages: null,
            is_deletion_pending: false,
            is_deleted: true,
            deleted_at: now.toISOString(),
          })
          .eq('id', userId);

        if (anonymiseError) {
          this.logger.error(
            `Failed to anonymise user ${userId}: ${anonymiseError.message}`,
          );
        } else {
          this.logger.log(`Finalised deletion for user ${userId}`);
        }
      } catch (err) {
        this.logger.error(
          `Unexpected error finalising deletion for user ${userId}`,
          err,
        );
      }
    }
  }

  /**
   * Remove all personal data for a user from related tables.
   */
  private async wipeUserData(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Delete chat messages
    await supabase.from('chat_messages').delete().eq('sender_id', userId);

    // Delete moments
    await supabase.from('moments').delete().eq('author_id', userId);

    // Delete moment comments
    await supabase
      .from('moment_comments')
      .delete()
      .eq('author_id', userId);

    // Delete flashcards
    await supabase.from('flashcards').delete().eq('user_id', userId);

    // Delete decks
    await supabase.from('decks').delete().eq('user_id', userId);

    // Delete favourites
    await supabase.from('favourites').delete().eq('user_id', userId);

    // Delete blocks (both directions)
    await supabase.from('blocks').delete().eq('blocker_id', userId);
    await supabase.from('blocks').delete().eq('blocked_id', userId);

    // Delete login history
    await supabase.from('login_history').delete().eq('user_id', userId);

    // Delete reports
    await supabase.from('reports').delete().eq('reporter_id', userId);

    // Delete notifications
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userId);

    // Scrub escrow PII for transactions involving the deleted user
    // (we anonymise free-text fields instead of deleting the records
    // to preserve the counterparty's financial records)
    await supabase
      .from('escrow_transactions' as never)
      .update({
        reason: '[DELETED_USER]',
        metadata: {},
      } as never)
      .eq('payer_id' as never, userId as never);

    await supabase
      .from('escrow_transactions' as never)
      .update({
        reason: '[DELETED_USER_RECEIVER]',
        metadata: {},
      } as never)
      .eq('payee_id' as never, userId as never);

    // Wipe monetisation transactions
    await supabase
      .from('monetisation_transactions')
      .delete()
      .eq('user_id', userId);

    this.logger.log(`Wiped personal data for user ${userId}`);
  }
}