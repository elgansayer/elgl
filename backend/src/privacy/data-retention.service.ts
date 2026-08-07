import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
   * Remove ALL personal data for a user from related tables.
   *
   * GDPR "right to erasure" -- comprehensively wipes every user-owned record
   * across the LingQ Reading Engine (flashcards/decks), chat, moments,
   * gamification, social graphs, notifications, monetisation, and security.
   */
  private async wipeUserData(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // --- LingQ Reading Engine / SRS ---
    // Delete deck_flashcards junction rows for user's decks first (FK cascade handles
    // most, but explicit deletion ensures clean wipe regardless of cascade config).
    const { data: userDecks } = await supabase
      .from('decks')
      .select('id')
      .eq('user_id', userId);
    if (userDecks && userDecks.length > 0) {
      const deckIds = (userDecks as Array<{ id: string }>).map((d) => d.id);
      await supabase.from('deck_flashcards').delete().in('deck_id', deckIds);
    }
    await supabase.from('flashcards').delete().eq('user_id', userId);
    await supabase.from('decks').delete().eq('user_id', userId);

    // --- Moments ---
    // Delete moment likes by the user
    await supabase.from('moment_likes').delete().eq('user_id', userId);
    // Delete moment comments by the user
    await supabase.from('moment_comments').delete().eq('author_id', userId);
    // Delete moments authored by the user
    await supabase.from('moments').delete().eq('author_id', userId);

    // --- Chat ---
    // Delete message reactions by the user
    await supabase.from('message_reactions').delete().eq('user_id', userId);
    // Delete chat messages
    await supabase.from('chat_messages').delete().eq('sender_id', userId);
    // Delete chat room memberships
    await supabase.from('chat_room_members').delete().eq('user_id', userId);
    // Delete chat group memberships
    await supabase.from('chat_group_members').delete().eq('user_id', userId);

    // --- Favourites ---
    await supabase.from('favourites').delete().eq('user_id', userId);

    // --- Gamification & learning ---
    await supabase.from('user_achievements').delete().eq('user_id', userId);
    await supabase.from('milestones').delete().eq('user_id', userId);

    // --- Social graph ---
    await supabase.from('user_follows').delete().eq('follower_id', userId);
    await supabase.from('user_follows').delete().eq('following_id', userId);
    await supabase.from('user_profile_likes').delete().eq('liker_id', userId);
    await supabase.from('user_profile_likes').delete().eq('liked_id', userId);
    await supabase.from('profile_visits').delete().eq('visitor_id', userId);
    await supabase.from('profile_visits').delete().eq('viewed_id', userId);
    await supabase.from('study_buddy_requests').delete().eq('requester_id', userId);
    await supabase.from('study_buddy_requests').delete().eq('partner_id', userId);

    // --- Hobby tags ---
    await supabase.from('user_hobby_tags').delete().eq('user_id', userId);

    // --- Audio room notes ---
    await supabase.from('audio_room_notes').delete().eq('author_id', userId);

    // --- Blocks (both directions) ---
    await supabase.from('blocks').delete().eq('blocker_id', userId);
    await supabase.from('blocks').delete().eq('blocked_id', userId);

    // --- Coin purchases ---
    await supabase.from('coin_purchases').delete().eq('user_id', userId);

    // --- Gift transactions ---
    await supabase.from('gift_transactions').delete().eq('sender_id', userId);
    await supabase.from('gift_transactions').delete().eq('receiver_id', userId);

    // --- Sticker packs ---
    await supabase.from('user_sticker_packs').delete().eq('user_id', userId);

    // --- Subscriptions / IAP ---
    await supabase.from('apple_subscriptions').delete().eq('user_id', userId);
    await supabase.from('google_play_purchases').delete().eq('user_id', userId);

    // --- Security & audit ---
    await supabase.from('login_history').delete().eq('user_id', userId);
    await supabase.from('reports').delete().eq('reporter_id', userId);
    await supabase.from('safety_reports').delete().eq('reporter_id', userId);
    await supabase.from('password_reset_tokens').delete().eq('user_id', userId);

    // --- Notifications ---
    await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', userId);
    await supabase
      .from('notifications')
      .delete()
      .eq('actor_id', userId);

    this.logger.log(`Wiped all personal data for user ${userId}`);
  }
}