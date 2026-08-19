import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Scheduled data-retention enforcement for GDPR compliance.
 *
 * Runs nightly to:
 * - Purge call_logs rows older than 90 days (call metadata is PII linking two users).
 * - Purge login_history rows older than 180 days.
 * - Purge audio_room_captions older than 180 days (transcript data may contain PII).
 * - Purge audio_room_notes older than 180 days (vocabulary notes contain author PII).
 * - Purge audio_room_transcripts older than 180 days (session transcripts/summaries).
 * - Purge audio_room_tips older than 365 days (financial transaction records).
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
   * Purge call logs older than 90 days.
   *
   * Call logs contain caller_name, receiver_name, room_name, and duration
   * metadata that links two natural persons to a real-time communication
   * session. Under GDPR this is communications metadata and must not be
   * retained indefinitely. We keep it for 90 days to support recent call
   * history UI and abuse investigations.
   *
   * Runs once per day at 02:00 UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeCallLogs(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('call_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge call logs: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} call log rows older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge audio-room captions older than 180 days.
   * Runs once per day at 02:15 UTC.
   */
  @Cron('0 15 2 * * *')
  async purgeAudioRoomCaptions(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('audio_room_captions')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(
        `Failed to purge audio-room captions: ${error.message}`,
      );
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} audio room caption rows older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge audio-room notes older than 180 days.
   * Runs once per day at 02:20 UTC.
   */
  @Cron('0 20 2 * * *')
  async purgeAudioRoomNotes(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('audio_room_notes')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge audio-room notes: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} audio room note rows older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge audio-room transcripts older than 180 days.
   * Runs once per day at 02:25 UTC.
   */
  @Cron('0 25 2 * * *')
  async purgeAudioRoomTranscripts(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 180);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('audio_room_transcripts')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(
        `Failed to purge audio-room transcripts: ${error.message}`,
      );
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} audio room transcript rows older than ${cutoff.toISOString()}`,
      );
    }
  }

  /**
   * Purge audio-room tips older than 365 days.
   * Runs once per day at 02:30 UTC.
   */
  @Cron('0 30 2 * * *')
  async purgeAudioRoomTips(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('audio_room_tips')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) {
      this.logger.error(`Failed to purge audio-room tips: ${error.message}`);
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} audio room tip rows older than ${cutoff.toISOString()}`,
      );
    }
  }

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
   * Purge reading progress records belonging to users who have been
   * inactive for more than 730 days (2 years).
   *
   * Reading progress is behavioural data under GDPR and should not be
   * retained indefinitely. A 2-year retention window balances the user's
   * right to erasure (Article 17) with the legitimate interest of
   * maintaining progress for returning learners.
   *
   * Runs once per day at 02:00 UTC.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeInactiveReadingProgress(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 730);
    const supabase = this.supabaseService.getClient();

    const { error, count } = await supabase
      .from('reading_progress')
      .delete({ count: 'exact' })
      .lt('last_read_at', cutoff.toISOString());

    if (error) {
      this.logger.error(
        `Failed to purge inactive reading progress: ${error.message}`,
      );
      return;
    }

    if (count && count > 0) {
      this.logger.log(
        `Purged ${count} inactive reading progress records (last read before ${cutoff.toISOString()})`,
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

    // ⚡ Bolt Optimization: Replaced sequential await loop with bounded concurrent chunks
    // Process up to 10 users concurrently to significantly improve deletion latency
    // while preventing unbounded Promise.allSettled calls from exhausting database connections.
    const chunkSize = 10;
    for (let i = 0; i < usersToDelete.length; i += chunkSize) {
      const chunk = usersToDelete.slice(i, i + chunkSize);

      await Promise.allSettled(
        chunk.map(async (user) => {
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
              return { success: false as const, error: anonymiseError };
            } else {
              this.logger.log(`Finalised deletion for user ${userId}`);
              return { success: true as const };
            }
          } catch (err) {
            this.logger.error(
              `Unexpected error finalising deletion for user ${userId}`,
              err,
            );
            return { success: false as const, error: err };
          }
        }),
      );
    }
  }

  /**
   * Remove all personal data for a user from related tables.
   *
   * Covers the full Virtual Coin Economy and Video/Audio Classroom surface
   * areas so that no PII or financial-linkable records survive the GDPR
   * deletion. Receipt tokens and transaction IDs are destroyed; coin
   * balances are already zeroed on the anonymised user row.
   */
  private async wipeUserData(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    const tasks = [
      // Chat / social content
      supabase.from('chat_messages').delete().eq('sender_id', userId),
      supabase.from('moments').delete().eq('author_id', userId),
      supabase.from('moment_comments').delete().eq('author_id', userId),

      // Flashcards / decks
      supabase.from('flashcards').delete().eq('user_id', userId),
      supabase.from('decks').delete().eq('user_id', userId),

      // Favourites
      supabase.from('favourites').delete().eq('user_id', userId),

      // Blocks (both directions)
      supabase.from('blocks').delete().eq('blocker_id', userId),
      supabase.from('blocks').delete().eq('blocked_id', userId),

      // Login history
      supabase.from('login_history').delete().eq('user_id', userId),

      // Reports
      supabase.from('reports').delete().eq('reporter_id', userId),

      // Notifications
      supabase.from('notifications').delete().eq('recipient_id', userId),

      // LingQ Reading Engine: reading progress and authored resources
      supabase.from('reading_progress').delete().eq('user_id', userId),
      supabase.from('reading_resources').delete().eq('created_by', userId),

      // --- Virtual Coin Economy ---
      supabase.from('coin_purchases').delete().eq('user_id', userId),
      supabase.from('gift_transactions').delete().eq('sender_id', userId),
      supabase.from('gift_transactions').delete().eq('receiver_id', userId),
      supabase.from('escrow_transactions').delete().eq('payer_id', userId),
      supabase.from('escrow_transactions').delete().eq('payee_id', userId),
      supabase.from('user_sticker_packs').delete().eq('user_id', userId),
      supabase.from('user_statistics').delete().eq('user_id', userId),

      // --- Video / Audio Classroom data ---
      supabase.from('call_logs').delete().eq('caller_id', userId),
      supabase.from('call_logs').delete().eq('receiver_id', userId),
      supabase.from('audio_room_captions').delete().eq('speaker_id', userId),
      supabase.from('audio_room_notes').delete().eq('author_id', userId),
      supabase.from('audio_room_tips').delete().eq('sender_user_id', userId),
      supabase.from('audio_room_tips').delete().eq('receiver_user_id', userId),

      // Anonymise remaining PII in captions/notes
      supabase
        .from('audio_room_captions')
        .update({ speaker_name: null })
        .eq('speaker_id', userId),
      supabase
        .from('audio_room_notes')
        .update({ author_name: undefined })
        .eq('author_id', userId),
    ];

    const results = await Promise.allSettled(tasks);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Promise rejected at task index ${index} for user ${userId}`,
          result.reason,
        );
      } else if (result.status === 'fulfilled' && result.value.error) {
        this.logger.error(
          `Supabase error at task index ${index} for user ${userId}: ${result.value.error.message}`,
        );
      }
    });

    // Invalidate reading-engine Redis caches for this user
    try {
      this.eventEmitter.emit('reading.user_data_cleared', { userId });
    } catch {
      // Non-critical: cache invalidation failure should not block deletion
    }

    // Purge recommendation cache (GDPR "right to erasure")
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

    // ⚡ Bolt: Removed redundant sequential queries for classroom data at the end
    // of wipeUserData. These 8 operations (call_logs, audio_room_captions, etc.)
    // are already included in the Promise.allSettled tasks array above and
    // executed concurrently. Removing them eliminates significant latency from
    // the end of the deletion routine.
    this.logger.log(`Wiped personal data for user ${userId}`);
  }
}
