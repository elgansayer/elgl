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

    // 1) Basic profile (includes location data for GDPR right to access)
    const queries = [
      supabase
        .from('users')
        .select(
          'id, display_name, native_language, target_languages, bio_text, avatar_url, audio_intro_url, location, mock_location, is_vip, vip_tier, coins_balance, study_streak_days, correction_ratio, is_serious_learner, privacy_hide_from_search, privacy_hide_location, is_deletion_pending, created_at',
        )
        .eq('id', userId)
        .single(),
      supabase
        .from('moments')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('moment_comments')
        .select('*')
        .eq('author_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('decks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('favourites')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('escrow_transactions')
        .select('*')
        .eq('payer_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('escrow_transactions')
        .select('*')
        .eq('payee_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('gift_transactions')
        .select('*')
        .eq('sender_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('gift_transactions')
        .select('*')
        .eq('receiver_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_sticker_packs')
        .select('*')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
      supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('reading_resources')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false }),
    ];

    const results = await Promise.allSettled(queries);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Promise rejected at task index ${index} for user ${userId} when fetching user data for GDPR archive export`,
          result.reason,
        );
      } else if (result.status === 'fulfilled' && result.value.error) {
        this.logger.error(
          `Supabase error at task index ${index} for user ${userId} when fetching user data for GDPR archive export: ${result.value.error.message}`,
        );
      }
    });

    const getValue = (index: number) => {
      const res = results[index];
      if (res.status === 'fulfilled' && res.value && res.value.data) {
        return res.value.data;
      }
      return null;
    };

    const userProfile = getValue(0);
    const userMoments = getValue(1);
    const userMomentComments = getValue(2);
    const userChatMessages = getValue(3);
    const userFlashcards = getValue(4);
    const userDecks = getValue(5) as any[];

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

    const userFavourites = getValue(6);
    const coinPurchases = getValue(7) as any[];
    const escrowAsPayer = getValue(8) as any[];
    const escrowAsPayee = getValue(9) as any[];

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

    const sentGifts = getValue(10) as any[];
    const receivedGifts = getValue(11) as any[];

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

    const userStickerPacks = getValue(12);
    const readingProgress = getValue(13);
    const readingResources = getValue(14);

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
