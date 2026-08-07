import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { ArchiveRequestDto } from './dto/archive-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { scrubCoinPurchasesForArchive } from '../economy/sanitise-economy.helper';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async requestArchive(userId: string, dto: ArchiveRequestDto): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // 1. Collect personal data for the archive
    const userData = await this.collectUserData(userId);
    const jsonBlob = JSON.stringify(userData, null, 2);

    // 2. Upload to a dedicated Supabase storage bucket
    const fileName = `archive_${userId}_${Date.now()}.json`;
    const { error: uploadError } = await supabase.storage
      .from('gdpr-archives')
      .upload(fileName, jsonBlob, {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadError) {
      this.logger.error(
        `Failed to upload archive for user ${userId}: ${uploadError.message}`,
      );
      throw new BadRequestException('Failed to upload archive file');
    }

    const { data: publicUrlData } = supabase.storage
      .from('gdpr-archives')
      .getPublicUrl(fileName);

    const archiveUrl = publicUrlData.publicUrl;

    // 3. Insert the archive record
    const { error } = await supabase.from('archive_requests').insert({
      user_id: userId,
      requested_at: new Date().toISOString(),
      archive_url: archiveUrl,
      receipt_id: dto.receipt_id ?? null,
      app_store: dto.app_store ?? null,
    });

    if (error) {
      this.logger.error(`Failed to insert archive request: ${error.message}`);
      throw new BadRequestException('Failed to create archive request');
    }

    this.logger.log(`Archive created for user ${userId}: ${archiveUrl}`);
    // In production, send an email with the download link
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    if (!dto.confirm_delete) {
      throw new BadRequestException('You must confirm account deletion');
    }

    const supabase = this.supabaseService.getClient();
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30-day grace period

    const { error } = await supabase
      .from('users')
      .update({
        scheduled_for_deletion_at: deletionDate.toISOString(),
        deletion_requested_at: new Date().toISOString(),
        is_deletion_pending: true,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to initiate deletion for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to initiate account deletion');
    }

    this.logger.log(
      `Deletion pending for user ${userId}, scheduled for ${deletionDate.toISOString()}`,
    );
  }

  async cancelDeletion(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({
        scheduled_for_deletion_at: null,
        deletion_requested_at: null,
        is_deletion_pending: false,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to cancel deletion for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to cancel account deletion');
    }

    this.logger.log(`Account deletion cancelled for user ${userId}`);
  }

  // -----------------------------------------------------------------------
  //  Private helper that gathers all user data for the GDPR archive export
  //  Covers the full LingQ Reading Engine: SRS flashcards, decks, curated
  //  content progress, and all social/economic/game data.
  // -----------------------------------------------------------------------
  private async collectUserData(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();

    // 1) Basic profile
    const { data: userProfile } = await supabase
      .from('users')
      .select(
        'id, display_name, native_language, target_languages, bio_text, avatar_url, audio_intro_url, location, mock_location, is_vip, vip_tier, coins_balance, study_streak_days, correction_ratio, is_serious_learner, created_at',
      )
      .eq('id', userId)
      .single();

    // 2) Moments authored by the user
    const { data: userMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    // 3) Moment comments authored by the user
    const { data: userMomentComments } = await supabase
      .from('moment_comments')
      .select('*')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    // 4) Chat messages sent by the user (PII-scrubbed)
    const { data: userChatMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });

    // 5) Flashcards saved by the user (LingQ SRS engine)
    const { data: userFlashcards } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 5b) Decks created by the user (SRS organisation)
    const { data: userDecks } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 5c) Deck-flashcard junction records for the user's decks
    let userDeckFlashcards: unknown[] = [];
    if (userDecks && userDecks.length > 0) {
      const deckIds = userDecks.map((d: { id: string }) => d.id);
      const { data: junctionData } = await supabase
        .from('deck_flashcards')
        .select('*')
        .in('deck_id', deckIds)
        .order('added_at', { ascending: false });
      userDeckFlashcards = junctionData ?? [];
    }

    // 6) Favourites bookmarked by the user
    const { data: userFavourites } = await supabase
      .from('favourites')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

// 7) Coin purchases (GDPR: receipt tokens + transaction IDs scrubbed)
    const { data: coinPurchases } = await supabase
      .from('coin_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 8) Gift transactions (sent and received)
    const { data: sentGifts } = await supabase
      .from('gift_transactions')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });

    const { data: receivedGifts } = await supabase
      .from('gift_transactions')
      .select('*')
      .eq('receiver_id', userId)
      .order('created_at', { ascending: false });

    const giftTransactions = [
      ...(sentGifts ?? []).map((g: Record<string, unknown>) => ({
        ...g,
        direction: 'sent',
      })),
      ...(receivedGifts ?? []).map((g: Record<string, unknown>) => ({
        ...g,
        direction: 'received',
      })),
    ];

    // 10) Sticker pack ownership
    const { data: userStickerPacks } = await supabase
      .from('user_sticker_packs')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    // --- LingQ Reading Engine + GDPR: additional user-data tables ---

    // 10) User achievements (gamification)
    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    // 11) Milestones (language learning progress)
    const { data: userMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 12) Study buddy requests (sent and received)
    const { data: sentBuddyRequests } = await supabase
      .from('study_buddy_requests')
      .select('*')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false });

    const { data: receivedBuddyRequests } = await supabase
      .from('study_buddy_requests')
      .select('*')
      .eq('partner_id', userId)
      .order('created_at', { ascending: false });

    // 13) Hobby tags assigned by the user
    const { data: userHobbyTags } = await supabase
      .from('user_hobby_tags')
      .select('*')
      .eq('user_id', userId);

    // 14) Chat room memberships
    const { data: chatRoomMemberships } = await supabase
      .from('chat_room_members')
      .select('*')
      .eq('user_id', userId);

    // 15) Chat group memberships
    const { data: chatGroupMemberships } = await supabase
      .from('chat_group_members')
      .select('*')
      .eq('user_id', userId);

    // 16) Message reactions by the user
    const { data: messageReactions } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('user_id', userId);

    // 17) Audio room notes written by the user
    const { data: audioRoomNotes } = await supabase
      .from('audio_room_notes')
      .select('*')
      .eq('author_id', userId);

    // 18) Follows (following and followers)
    const { data: userFollowing } = await supabase
      .from('user_follows')
      .select('*')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false });

    const { data: userFollowers } = await supabase
      .from('user_follows')
      .select('*')
      .eq('following_id', userId)
      .order('created_at', { ascending: false });

    // 19) Profile likes (given and received)
    const { data: profileLikesGiven } = await supabase
      .from('user_profile_likes')
      .select('*')
      .eq('liker_id', userId);

    // 20) Profile visits
    const { data: profileVisits } = await supabase
      .from('profile_visits')
      .select('*')
      .eq('visitor_id', userId);

    // 21) Block records
    const { data: userBlocks } = await supabase
      .from('blocks')
      .select('*')
      .eq('blocker_id', userId);

    // 22) Login history
    const { data: loginHistory } = await supabase
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // 23) Apple subscriptions (scrub receipt tokens)
    const { data: appleSubscriptions } = await supabase
      .from('apple_subscriptions')
      .select('*')
      .eq('user_id', userId);

    // 24) Google Play purchases (scrub receipt tokens)
    const { data: googlePlayPurchases } = await supabase
      .from('google_play_purchases')
      .select('*')
      .eq('user_id', userId);

    // Scrub PII from user-generated content in the archive
    const scrubContentText = (text: string | null | undefined): string | null => {
      if (!text) return text as null;
      return text
        .replace(
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
          '[EMAIL_REDACTED]',
        )
        .replace(
          /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{4,10}/g,
          '[PHONE_REDACTED]',
        );
    };

    // Scrub PII from flashcard original_context fields
    const scrubbedFlashcards = (userFlashcards ?? []).map(
      (card: Record<string, unknown>) => {
        if (card.original_context && typeof card.original_context === 'string') {
          return {
            ...card,
            original_context: scrubContentText(card.original_context),
          };
        }
        return card;
      },
    );

    // Scrub PII from chat messages
    const scrubbedChatMessages = (userChatMessages ?? []).map(
      (msg: Record<string, unknown>) => {
        const scrubbed = { ...msg };
        if (msg.text && typeof msg.text === 'string') {
          scrubbed.text = scrubContentText(msg.text);
        }
        return scrubbed;
      },
    );

    // Scrub PII from moments
    const scrubbedMoments = (userMoments ?? []).map(
      (m: Record<string, unknown>) => {
        const scrubbed = { ...m };
        if (m.text && typeof m.text === 'string') {
          scrubbed.text = scrubContentText(m.text);
        }
        return scrubbed;
      },
    );

    // Scrub PII from moment comments
    const scrubbedMomentComments = (userMomentComments ?? []).map(
      (c: Record<string, unknown>) => {
        const scrubbed = { ...c };
        if (c.text && typeof c.text === 'string') {
          scrubbed.text = scrubContentText(c.text);
        }
        return scrubbed;
      },
    );

    // Scrub receipt tokens from subscription records
    const scrubSubscriptionReceipt = (
      records: unknown[] | null | undefined,
    ): unknown[] => {
      if (!records || !Array.isArray(records)) return records ?? [];
      return records.map((record: unknown) => {
        if (record !== null && typeof record === 'object') {
          const r = record as Record<string, unknown>;
          const scrubbed = { ...r };
          for (const key of ['receipt_token', 'transaction_id', 'original_transaction_id']) {
            if (typeof scrubbed[key] === 'string') {
              const val = scrubbed[key] as string;
              scrubbed[key] =
                val.length < 8
                  ? '[REDACTED-SHORT-TOKEN]'
                  : '***...' + val.slice(-4);
            }
          }
          return scrubbed;
        }
        return record;
      });
    };

    return {
      export_generated_at: new Date().toISOString(),
      user_profile: userProfile ?? null,
      // Content: PII-scrubbed
      moments: scrubbedMoments ?? [],
      moment_comments: scrubbedMomentComments ?? [],
      chat_messages: scrubbedChatMessages ?? [],
      // LingQ Reading Engine / SRS
      flashcards: scrubbedFlashcards ?? [],
      decks: userDecks ?? [],
      deck_flashcards: userDeckFlashcards,
      // Social & economy
      favourites: userFavourites ?? [],
      coin_purchases: scrubCoinPurchasesForArchive(coinPurchases ?? []),
      gift_transactions: giftTransactions ?? [],
      user_sticker_packs: userStickerPacks ?? [],
      // Gamification & learning
      user_achievements: userAchievements ?? [],
      milestones: userMilestones ?? [],
      study_buddy_requests: [
        ...(sentBuddyRequests ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          direction: 'sent',
        })),
        ...(receivedBuddyRequests ?? []).map((r: Record<string, unknown>) => ({
          ...r,
          direction: 'received',
        })),
      ],
      hobby_tags: userHobbyTags ?? [],
      // Chat & rooms
      chat_room_memberships: chatRoomMemberships ?? [],
      chat_group_memberships: chatGroupMemberships ?? [],
      message_reactions: messageReactions ?? [],
      audio_room_notes: audioRoomNotes ?? [],
      // Social graph
      following: userFollowing ?? [],
      followers: userFollowers ?? [],
      profile_likes_given: profileLikesGiven ?? [],
      profile_visits: profileVisits ?? [],
      blocks: userBlocks ?? [],
      // Security
      login_history: loginHistory ?? [],
      // Monetisation (scrubbed receipt tokens)
      apple_subscriptions: scrubSubscriptionReceipt(appleSubscriptions),
      google_play_purchases: scrubSubscriptionReceipt(googlePlayPurchases),
    };
  }
}
