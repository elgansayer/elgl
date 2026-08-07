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

    // 4) Chat messages sent by the user
    const { data: userChatMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });

    // 5) Flashcards saved by the user
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

    // 9) Sticker pack ownership
    const { data: userStickerPacks } = await supabase
      .from('user_sticker_packs')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    return {
      export_generated_at: new Date().toISOString(),
      user_profile: userProfile ?? null,
      moments: userMoments ?? [],
      moment_comments: userMomentComments ?? [],
      chat_messages: userChatMessages ?? [],
      flashcards: userFlashcards ?? [],
      decks: userDecks ?? [],
      deck_flashcards: userDeckFlashcards,
      favourites: userFavourites ?? [],
      coin_purchases: scrubCoinPurchasesForArchive(coinPurchases ?? []),
      gift_transactions: giftTransactions ?? [],
      user_sticker_packs: userStickerPacks ?? [],
    };
  }
}
