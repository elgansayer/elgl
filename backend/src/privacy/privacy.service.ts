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

const ARCHIVE_DOWNLOAD_TTL_SECONDS = 15 * 60;

export interface PrivacyStatus {
  is_deletion_pending: boolean;
  scheduled_for_deletion_at: string | null;
  latest_archive: {
    requested_at: string;
    download_url: string | null;
    expires_in_seconds: number | null;
  } | null;
}

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

    // 1. Collect personal data for the archive.
    const userData = await this.collectUserData(userId);
    const jsonBlob = JSON.stringify(userData, null, 2);

    // 2. Upload to the private GDPR storage bucket. User-scoped object paths
    // make lifecycle cleanup and incident investigation deterministic without
    // exposing a public URL.
    const requestedAt = new Date().toISOString();
    const fileName = `${userId}/archive_${Date.now()}.json`;
    const archiveBucket = supabase.storage.from('gdpr-archives');
    const { error: uploadError } = await archiveBucket.upload(fileName, jsonBlob, {
      contentType: 'application/json',
      upsert: false,
    });

    if (uploadError) {
      this.logger.error(
        `Failed to upload GDPR archive for user ${userId}: ${uploadError.message}`,
      );
      throw new BadRequestException('Failed to upload archive file');
    }

    // 3. The archive_url column is retained for compatibility, but for new
    // private archives it stores the object path rather than a public URL.
    // getStatus() turns that path into a short-lived signed URL on demand.
    const { error } = await supabase.from('archive_requests').insert({
      user_id: userId,
      requested_at: requestedAt,
      archive_url: fileName,
      receipt_id: dto.receipt_id ?? null,
      app_store: dto.app_store ?? null,
    });

    if (error) {
      // Best-effort rollback so a failed metadata write does not strand an
      // otherwise undiscoverable archive object.
      try {
        await archiveBucket.remove([fileName]);
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to clean up orphaned GDPR archive for user ${userId}`,
          cleanupError,
        );
      }
      this.logger.error(`Failed to insert archive request: ${error.message}`);
      throw new BadRequestException('Failed to create archive request');
    }

    this.logger.log(`GDPR archive created for user ${userId}`);
  }

  async getStatus(userId: string): Promise<PrivacyStatus> {
    const supabase = this.supabaseService.getClient();

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_deletion_pending, scheduled_for_deletion_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      this.logger.error(
        `Failed to load privacy status for user ${userId}: ${userError?.message ?? 'user not found'}`,
      );
      throw new BadRequestException('Failed to load privacy status');
    }

    const { data: archiveRows, error: archiveError } = await supabase
      .from('archive_requests')
      .select('requested_at, archive_url')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(1);

    if (archiveError) {
      this.logger.error(
        `Failed to load archive status for user ${userId}: ${archiveError.message}`,
      );
      throw new BadRequestException('Failed to load archive status');
    }

    const latestArchive = archiveRows?.[0] ?? null;
    const archivePath = latestArchive?.archive_url ?? '';
    const isPrivateObjectPath =
      archivePath.length > 0 &&
      !archivePath.startsWith('http://') &&
      !archivePath.startsWith('https://');
    let downloadUrl: string | null = null;
    let expiresInSeconds: number | null = null;

    if (isPrivateObjectPath) {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('gdpr-archives')
        .createSignedUrl(archivePath, ARCHIVE_DOWNLOAD_TTL_SECONDS);

      if (signedUrlError) {
        this.logger.warn(
          `Failed to create signed GDPR archive URL for user ${userId}: ${signedUrlError.message}`,
        );
      } else {
        downloadUrl = signedUrlData.signedUrl;
        expiresInSeconds = ARCHIVE_DOWNLOAD_TTL_SECONDS;
      }
    }

    return {
      is_deletion_pending: Boolean(user.is_deletion_pending),
      scheduled_for_deletion_at: user.scheduled_for_deletion_at ?? null,
      latest_archive: latestArchive
        ? {
            requested_at: latestArchive.requested_at,
            download_url: downloadUrl,
            expires_in_seconds: expiresInSeconds,
          }
        : null,
    };
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
