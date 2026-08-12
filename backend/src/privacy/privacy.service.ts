import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { ArchiveRequestDto } from './dto/archive-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  scrubCoinPurchasesForArchive,
  scrubEscrowTransactionsForArchive,
} from '../economy/sanitise-economy.helper';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly safetyCacheService: SafetyCacheInvalidationService,
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

    // GDPR: Immediately scrub location data and opt out of discovery
    const { error } = await supabase
      .from('users')
      .update({
        scheduled_for_deletion_at: deletionDate.toISOString(),
        deletion_requested_at: new Date().toISOString(),
        is_deletion_pending: true,
        privacy_hide_from_search: true,
        location: null,
        mock_location: null,
        mock_country: null,
        mock_city: null,
      })
      .eq('id', userId);

    if (error) {
      this.logger.error(
        `Failed to initiate deletion for user ${userId}: ${error.message}`,
      );
      throw new BadRequestException('Failed to initiate account deletion');
    }

    // Invalidate all Redis caches that may contain this user's data
    await this.safetyCacheService.invalidateUserCaches(userId);

    this.logger.log(
      `Deletion pending for user ${userId}, scheduled for ${deletionDate.toISOString()}. Location data scrubbed, discovery caches invalidated.`,
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

    // Run independent database queries concurrently using Promise.allSettled
    // to avoid N+1-like sequential execution latency.
    const promises = [
      // 0) Basic profile
      supabase
        .from('users')
        .select(
          'id, display_name, native_language, target_languages, bio_text, avatar_url, audio_intro_url, location, mock_location, is_vip, vip_tier, coins_balance, study_streak_days, correction_ratio, is_serious_learner, privacy_hide_from_search, privacy_hide_location, is_deletion_pending, created_at',
        )
        .eq('id', userId)
        .single(),
      // 1) Moments
      supabase
        .from('moments')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      // 2) Moment comments
      supabase
        .from('moment_comments')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      // 3) Chat messages
      supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false }),
      // 4) Flashcards
      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // 5) Decks (must fetch these first to fetch junction records)
      supabase
        .from('decks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // 6) Favourites
      supabase
        .from('favourites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // 7) Coin purchases
      supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      // 8) Escrow as payer
      supabase
        .from('escrow_transactions')
        .select('*')
        .eq('payer_id', userId)
        .order('created_at', { ascending: false }),
      // 9) Escrow as payee
      supabase
        .from('escrow_transactions')
        .select('*')
        .eq('payee_id', userId)
        .order('created_at', { ascending: false }),
      // 10) Sent gifts
      supabase
        .from('gift_transactions')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false }),
      // 11) Received gifts
      supabase
        .from('gift_transactions')
        .select('*')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false }),
      // 12) Sticker pack ownership
      supabase
        .from('user_sticker_packs')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
      // 13) Reading progress
      supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId)
        .single(),
      // 14) Reading resources
      supabase
        .from('reading_resources')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false }),
    ];

    const results = await Promise.allSettled(promises);

    // Helper to safely extract data from fulfilled promises
    const getData = (index: number) => {
      const res = results[index];
      if (res.status === 'fulfilled' && res.value && res.value.data) {
        return res.value.data;
      }
      if (res.status === 'rejected') {
        this.logger.error(
          `Data collection query at index ${index} failed`,
          res.reason,
        );
      } else if (res.status === 'fulfilled' && res.value.error) {
        this.logger.error(
          `Data collection query at index ${index} failed with Supabase error`,
          res.value.error,
        );
      }
      return null;
    };

    const userProfile = getData(0);
    const userMoments = getData(1);
    const userMomentComments = getData(2);
    const userChatMessages = getData(3);
    const userFlashcards = getData(4);
    const userDecks = getData(5) as any[];
    const userFavourites = getData(6);
    const coinPurchases = getData(7);
    const escrowAsPayer = getData(8) as any[];
    const escrowAsPayee = getData(9) as any[];
    const sentGifts = getData(10) as any[];
    const receivedGifts = getData(11) as any[];
    const userStickerPacks = getData(12);
    const readingProgress = getData(13);
    const readingResources = getData(14);

    // Fetch deck-flashcard junction records based on the fetched decks
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

    const escrowTransactions = [
      ...(escrowAsPayer ?? []).map((e: Record<string, unknown>) => ({
        ...e,
        role: 'payer',
      })),
      ...(escrowAsPayee ?? []).map((e: Record<string, unknown>) => ({
        ...e,
        role: 'payee',
      })),
    ];

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
      escrow_transactions: scrubEscrowTransactionsForArchive(
        escrowTransactions,
        userId,
      ),
      gift_transactions: giftTransactions ?? [],
      user_sticker_packs: userStickerPacks ?? [],
      reading_progress: readingProgress ?? null,
      reading_resources: readingResources ?? [],
    };
  }
}
