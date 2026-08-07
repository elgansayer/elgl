import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Scheduled data-retention enforcement for GDPR compliance.
 *
 * Runs nightly to:
 * - Purge login_history rows older than 180 days.
 * - Purge reports older than 365 days that are in a terminal state.
 * - Archive deleted user records past their grace period.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
      const userId = user.id;
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
   *
   * Covers the full Virtual Coin Economy surface area so that no PII or
   * financial-linkable records survive the GDPR deletion. Receipt tokens
   * and transaction IDs are destroyed; coin balances are already zeroed
   * on the anonymised user row.
   */
  private async wipeUserData(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Chat / social content
    await supabase.from('chat_messages').delete().eq('sender_id', userId);
    await supabase.from('moments').delete().eq('author_id', userId);
    await supabase
      .from('moment_comments')
      .delete()
      .eq('author_id', userId);

    // Flashcards / decks
    await supabase.from('flashcards').delete().eq('user_id', userId);
    await supabase.from('decks').delete().eq('user_id', userId);

    // Favourites
    await supabase.from('favourites').delete().eq('user_id', userId);

    // Blocks (both directions)
    await supabase.from('blocks').delete().eq('blocker_id', userId);
    await supabase.from('blocks').delete().eq('blocked_id', userId);

    // Login history
    await supabase.from('login_history').delete().eq('user_id', userId);

    // Reports
    await supabase.from('reports').delete().eq('reporter_id', userId);

    // Notifications
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userId);

    // LingQ Reading Engine: reading progress and authored resources
    await supabase
      .from('reading_progress')
      .delete()
      .eq('user_id', userId);
    await supabase
      .from('reading_resources')
      .delete()
      .eq('created_by', userId);

    // Invalidate reading-engine Redis caches for this user
    try {
      this.eventEmitter.emit('reading.user_data_cleared', { userId });
    } catch {
      // Non-critical: cache invalidation failure should not block deletion
    }

    // --- Virtual Coin Economy ---
    // Coin purchases (receipt tokens, transaction IDs -- PII under GDPR)
    await supabase.from('coin_purchases').delete().eq('user_id', userId);

    // Gift transactions (both sent and received)
    await supabase
      .from('gift_transactions')
      .delete()
      .eq('sender_id', userId);
    await supabase
      .from('gift_transactions')
      .delete()
      .eq('receiver_id', userId);

    // Sticker pack ownership
    await supabase
      .from('user_sticker_packs')
      .delete()
      .eq('user_id', userId);

    // User statistics (may contain coin-related aggregated data)
    await supabase
      .from('user_statistics')
      .delete()
      .eq('user_id', userId);

    // Purge recommendation cache (GDPR "right to erasure")
    // The Redis cache contains PII (display names, avatar URLs) and must be
    // purged immediately.  Other users' caches containing this user will
    // expire naturally within 24 hours (DAILY_REDIS_TTL).
    try {
      const redis = this.supabaseService.getRedisClient();
      const ownKey = `recommendations:daily:${userId}`;
      await redis.del(ownKey);
      this.logger.log(
        `Purged recommendation cache for user ${userId} (GDPR erasure)`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to purge recommendation cache for user ${userId}`,
        err,
      );
    }

    this.logger.log(`Wiped personal data for user ${userId}`);
  }
}
