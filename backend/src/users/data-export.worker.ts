import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * GDPR data-export worker.
 *
 * Fetches ALL user-owned data from every table containing PII or user-generated
 * content, covering the full LingQ Reading Engine (flashcards, decks, SRS),
 * chat, moments, gamification, social graph, monetisation, and security audit
 * logs.
 */
@Injectable()
export class DataExportWorker {
  private readonly logger = new Logger(DataExportWorker.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    this.logger.log(`Starting full GDPR data export for user ${userId}`);

    try {
      const supabase = this.supabaseService.getClient();

      const [
        profileRes,
        momentsRes,
        commentsRes,
        messagesRes,
        flashcardsRes,
        decksRes,
        favouritesRes,
        achievementsRes,
        milestonesRes,
        hobbyTagsRes,
        chatRoomMembersRes,
        chatGroupMembersRes,
        messageReactionsRes,
        audioRoomNotesRes,
        followingRes,
        followersRes,
        profileLikesRes,
        profileVisitsRes,
        blocksRes,
        loginHistoryRes,
        coinPurchasesRes,
        sentGiftsRes,
        receivedGiftsRes,
        stickerPacksRes,
        appleSubRes,
        googlePlayRes,
        sentBuddyRes,
        receivedBuddyRes,
      ] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('moments').select('*').eq('author_id', userId),
        supabase.from('moment_comments').select('*').eq('author_id', userId),
        supabase.from('chat_messages').select('*').eq('sender_id', userId),
        supabase.from('flashcards').select('*').eq('user_id', userId),
        supabase.from('decks').select('*').eq('user_id', userId),
        supabase.from('favourites').select('*').eq('user_id', userId),
        supabase.from('user_achievements').select('*').eq('user_id', userId),
        supabase.from('milestones').select('*').eq('user_id', userId),
        supabase.from('user_hobby_tags').select('*').eq('user_id', userId),
        supabase.from('chat_room_members').select('*').eq('user_id', userId),
        supabase.from('chat_group_members').select('*').eq('user_id', userId),
        supabase.from('message_reactions').select('*').eq('user_id', userId),
        supabase.from('audio_room_notes').select('*').eq('author_id', userId),
        supabase.from('user_follows').select('*').eq('follower_id', userId),
        supabase.from('user_follows').select('*').eq('following_id', userId),
        supabase.from('user_profile_likes').select('*').eq('liker_id', userId),
        supabase.from('profile_visits').select('*').eq('visitor_id', userId),
        supabase.from('blocks').select('*').eq('blocker_id', userId),
        supabase.from('login_history').select('*').eq('user_id', userId),
        supabase.from('coin_purchases').select('*').eq('user_id', userId),
        supabase.from('gift_transactions').select('*').eq('sender_id', userId),
        supabase.from('gift_transactions').select('*').eq('receiver_id', userId),
        supabase.from('user_sticker_packs').select('*').eq('user_id', userId),
        supabase.from('apple_subscriptions').select('*').eq('user_id', userId),
        supabase.from('google_play_purchases').select('*').eq('user_id', userId),
        supabase.from('study_buddy_requests').select('*').eq('requester_id', userId),
        supabase.from('study_buddy_requests').select('*').eq('partner_id', userId),
      ]);

      // Fetch deck_flashcards for the user's decks
      let deckFlashcardsRes: { data: unknown[]; error: unknown } = {
        data: [],
        error: null,
      };
      if (decksRes.data && (decksRes.data as Array<{ id: string }>).length > 0) {
        const deckIds = (decksRes.data as Array<{ id: string }>).map(
          (d) => d.id,
        );
        const res = await supabase
          .from('deck_flashcards')
          .select('*')
          .in('deck_id', deckIds);
        deckFlashcardsRes = res as { data: unknown[]; error: unknown };
      }

      if (profileRes.error) {
        throw new Error(`Failed to fetch profile: ${profileRes.error.message}`);
      }

      const result: Record<string, unknown> = {
        export_generated_at: new Date().toISOString(),
        // Core profile
        profile: profileRes.data,
        // Content
        moments: momentsRes.data ?? [],
        moment_comments: commentsRes.data ?? [],
        chat_messages: messagesRes.data ?? [],
        // LingQ Reading Engine / SRS
        flashcards: flashcardsRes.data ?? [],
        decks: decksRes.data ?? [],
        deck_flashcards: deckFlashcardsRes.data ?? [],
        // Social & economy
        favourites: favouritesRes.data ?? [],
        coin_purchases: coinPurchasesRes.data ?? [],
        gift_transactions: [
          ...(sentGiftsRes.data ?? []).map((g: Record<string, unknown>) => ({
            ...g,
            direction: 'sent',
          })),
          ...(receivedGiftsRes.data ?? []).map((g: Record<string, unknown>) => ({
            ...g,
            direction: 'received',
          })),
        ],
        user_sticker_packs: stickerPacksRes.data ?? [],
        // Gamification & learning
        user_achievements: achievementsRes.data ?? [],
        milestones: milestonesRes.data ?? [],
        study_buddy_requests: [
          ...(sentBuddyRes.data ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            direction: 'sent',
          })),
          ...(receivedBuddyRes.data ?? []).map((r: Record<string, unknown>) => ({
            ...r,
            direction: 'received',
          })),
        ],
        hobby_tags: hobbyTagsRes.data ?? [],
        // Chat & rooms
        chat_room_memberships: chatRoomMembersRes.data ?? [],
        chat_group_memberships: chatGroupMembersRes.data ?? [],
        message_reactions: messageReactionsRes.data ?? [],
        audio_room_notes: audioRoomNotesRes.data ?? [],
        // Social graph
        following: followingRes.data ?? [],
        followers: followersRes.data ?? [],
        profile_likes_given: profileLikesRes.data ?? [],
        profile_visits: profileVisitsRes.data ?? [],
        blocks: blocksRes.data ?? [],
        // Security
        login_history: loginHistoryRes.data ?? [],
        // Monetisation
        apple_subscriptions: appleSubRes.data ?? [],
        google_play_purchases: googlePlayRes.data ?? [],
      };

      this.logger.log(`Full GDPR data export completed for user ${userId}`);
      return result;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`GDPR data export failed for user ${userId}: ${msg}`);
      throw error;
    }
  }
}
