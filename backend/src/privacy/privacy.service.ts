import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ArchiveRequestRow, PageResult, DeleteAccountDto } from './interfaces';
import { ConfigService } from '@nestjs/config';
import { SafetyCacheService } from '../safety/safety-cache.service';
import { DataScrubbingService } from './data-scrubbing.service';

const ARCHIVE_BUCKET = 'gdpr-archives';
const ARCHIVE_PAGE_SIZE = 1000;
const MAX_ROWS_PER_DATASET = 50000;
const DEFAULT_RETENTION_DAYS = 7;

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly safetyCacheService: SafetyCacheService,
    private readonly dataScrubbingService: DataScrubbingService,
  ) {}

  async generateArchive(userId: string, requestId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    try {
      const data = await this.buildArchiveData(userId);
      const json = JSON.stringify(data, null, 2);

      const objectKey = `user-${userId}-archive-${Date.now()}.json`;
      const { error: uploadError } = await supabase.storage
        .from(ARCHIVE_BUCKET)
        .upload(objectKey, json, {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: publicUrl } = supabase.storage
        .from(ARCHIVE_BUCKET)
        .getPublicUrl(objectKey);

      const { error: readyError } = await supabase
        .from('archive_requests')
        .update({
          status: 'ready',
          object_key: objectKey,
          archive_url: publicUrl.publicUrl,
          expires_at: new Date(
            Date.now() + this.archiveRetentionDays() * 24 * 60 * 60 * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', requestId);

      if (readyError) {
        throw new Error(`State update failed: ${readyError.message}`);
      }
    } catch (error) {
      const { error: updateError } = await supabase
        .from('archive_requests')
        .update({
          status: 'failed',
          failure_reason: (error as Error).message,
          failure_code: this.archiveFailureCode(error),
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', requestId)
        .eq('user_id', userId);

      this.logger.error('gdpr_archive_generation_failed');
      throw new ServiceUnavailableException(
        'Unable to build a complete data archive. Please try again.',
      );
    }
  }

  async purgeExpiredArchives(limit = 100): Promise<number> {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const supabase = this.supabaseService.getClient();
    const { data: rowsRaw, error } = await supabase
      .from('archive_requests')
      .select('*')
      .eq('status' as never, 'ready')
      .lte('expires_at' as never, new Date().toISOString() as never)
      .order('expires_at' as never, { ascending: true })
      .limit(boundedLimit);

    if (error) {
      this.logger.error('gdpr_archive_cleanup_lookup_failed');
      return 0;
    }

    const rows = (rowsRaw ?? []) as unknown as ArchiveRequestRow[];

    // ⚡ Bolt: Optimize archive cleanup by batching operations with Promise.allSettled
    // The query above explicitly limits to boundedLimit (max 100), ensuring this fan-out is safe.
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        if (row.object_key) {
          const { error: removeError } = await supabase.storage
            .from(ARCHIVE_BUCKET)
            .remove([row.object_key]);
          if (removeError) {
            this.logger.error('gdpr_archive_cleanup_object_failed');
            throw new Error('remove_failed');
          }
        }

        const { error: updateError } = await supabase
          .from('archive_requests')
          .update({
            status: 'expired',
            object_key: null,
            archive_url: null,
            updated_at: new Date().toISOString(),
          } as never)
          .eq('id', row.id);

        if (updateError) {
          throw new Error('update_failed');
        }

        return true;
      }),
    );

    const purged = results.filter((r) => r.status === 'fulfilled').length;

    if (purged > 0)
      this.logger.log(`gdpr_archive_cleanup_complete count=${purged}`);
    return purged;
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    if (!dto.confirm_delete) {
      throw new Error('Deletion must be confirmed');
    }

    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({
        status: 'pending_deletion',
        scheduled_deletion_at: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) {
      this.logger.error('gdpr_account_deletion_schedule_failed');
      throw new Error('Could not schedule account for deletion');
    }

    await this.safetyCacheService.invalidateUserCaches(userId);
  }

  async cancelDeletion(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('users')
      .update({
        status: 'active',
        scheduled_deletion_at: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', userId);

    if (error) {
      this.logger.error('gdpr_account_deletion_cancel_failed');
      throw new Error('Could not cancel account deletion');
    }

    await this.safetyCacheService.invalidateUserCaches(userId);
  }

  private async buildArchiveData(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      this.logger.error('gdpr_archive_dataset_failed dataset=profile');
      throw new Error('dataset_unavailable');
    }
    if (profile) {
      this.dataScrubbingService.scrubProfileForArchive(
        profile as Record<string, unknown>,
      );
    }

    const [
      moments,
      momentComments,
      chatMessages,
      loginHistory,
      flashcards,
      decks,
      favourites,
      coinPurchases,
      escrowAsPayer,
      escrowAsPayee,
      sentGifts,
      receivedGifts,
      stickerPacks,
      readingResources,
    ] = await Promise.all([
      this.fetchPaged('moments', async (from, to) => {
        const result = await supabase
          .from('moments')
          .select('*')
          .eq('author_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('moment_comments', async (from, to) => {
        const result = await supabase
          .from('moment_comments')
          .select('*')
          .eq('author_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('chat_messages', async (from, to) => {
        const result = await supabase
          .from('chat_messages')
          .select('*')
          .eq('sender_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('user_login_history', async (from, to) => {
        const result = await supabase
          .from('user_login_history')
          .select('*')
          .eq('user_id', userId)
          .order('login_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('flashcards', async (from, to) => {
        const result = await supabase
          .from('flashcards')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('decks', async (from, to) => {
        const result = await supabase
          .from('decks')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('favourites', async (from, to) => {
        const result = await supabase
          .from('favourites')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('coin_purchases', async (from, to) => {
        const result = await supabase
          .from('coin_purchases')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('escrow_transactions', async (from, to) => {
        const result = await supabase
          .from('escrow_transactions')
          .select('*')
          .eq('payer_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('escrow_transactions', async (from, to) => {
        const result = await supabase
          .from('escrow_transactions')
          .select('*')
          .eq('payee_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('gift_transactions', async (from, to) => {
        const result = await supabase
          .from('gift_transactions')
          .select('*')
          .eq('sender_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('gift_transactions', async (from, to) => {
        const result = await supabase
          .from('gift_transactions')
          .select('*')
          .eq('receiver_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('user_sticker_packs', async (from, to) => {
        const result = await supabase
          .from('user_sticker_packs')
          .select('*')
          .eq('user_id', userId)
          .order('purchased_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('reading_resources', async (from, to) => {
        const result = await supabase
          .from('reading_resources')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
    ]);

    const { data: readingProgress, error: readingProgressError } =
      await supabase
        .from('reading_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (readingProgressError) {
      this.logger.error('gdpr_archive_dataset_failed dataset=reading_progress');
      throw new Error('dataset_unavailable');
    }

    const deckRows = decks as Array<Record<string, unknown>>;
    const deckIds = deckRows
      .map((deck) => deck.id)
      .filter((id): id is string => typeof id === 'string');
    const deckFlashcards: unknown[] = [];
    for (let offset = 0; offset < deckIds.length; offset += 100) {
      const ids = deckIds.slice(offset, offset + 100);
      const chunk = await this.fetchPaged(
        'deck_flashcards',
        async (from, to) => {
          const result = await supabase
            .from('deck_flashcards')
            .select('*')
            .in('deck_id', ids)
            .order('added_at', { ascending: false })
            .range(from, to);
          return { data: result.data as unknown[] | null, error: result.error };
        },
      );
      deckFlashcards.push(...chunk);
      if (deckFlashcards.length > MAX_ROWS_PER_DATASET) {
        throw new Error('dataset_too_large');
      }
    }

    const escrowTransactions = [
      ...(escrowAsPayer as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        role: 'payer',
      })),
      ...(escrowAsPayee as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        role: 'payee',
      })),
    ].sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime(),
    );

    const giftTransactions = [
      ...(sentGifts as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        role: 'sender',
      })),
      ...(receivedGifts as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        role: 'receiver',
      })),
    ].sort(
      (a, b) =>
        new Date(b.created_at as string).getTime() -
        new Date(a.created_at as string).getTime(),
    );

    // Apply data minimization/scrubbing to exported sets.
    this.dataScrubbingService.scrubLoginHistory(
      loginHistory as Array<{ ip_address?: string | null }>,
    );
    this.dataScrubbingService.scrubCoinPurchaseRecords(
      coinPurchases as Array<{ receipt_token?: string | null }>,
    );
    // Note: Other collections may not require scrubbing for GDPR personal-data exports
    // because the user is downloading their own PII, not someone else's.

    return {
      metadata: {
        userId,
        generatedAt: new Date().toISOString(),
        version: '1.0',
      },
      profile,
      moments,
      momentComments,
      chatMessages,
      loginHistory,
      flashcards,
      decks,
      deckFlashcards,
      favourites,
      readingProgress: readingProgress || null,
      readingResources,
      economy: {
        coinPurchases,
        escrowTransactions,
        giftTransactions,
        stickerPacks,
      },
    };
  }

  private async fetchPaged(
    dataset: string,
    fetchPage: (from: number, to: number) => Promise<PageResult>,
  ): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let from = 0; ; from += ARCHIVE_PAGE_SIZE) {
      const page = await fetchPage(from, from + ARCHIVE_PAGE_SIZE - 1);
      if (page.error) {
        this.logger.error(`gdpr_archive_dataset_failed dataset=${dataset}`);
        throw new Error('dataset_unavailable');
      }

      const data = page.data ?? [];
      if (rows.length + data.length > MAX_ROWS_PER_DATASET) {
        this.logger.error(`gdpr_archive_dataset_too_large dataset=${dataset}`);
        throw new Error('dataset_too_large');
      }
      rows.push(...data);
      if (data.length < ARCHIVE_PAGE_SIZE) return rows;
    }
  }

  private archiveRetentionDays(): number {
    return this.boundedConfigNumber(
      'GDPR_ARCHIVE_RETENTION_DAYS',
      DEFAULT_RETENTION_DAYS,
      1,
      30,
    );
  }

  private boundedConfigNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const value = parseInt(this.configService.get<string>(key) ?? '', 10);
    if (isNaN(value)) return fallback;
    return Math.max(min, Math.min(value, max));
  }

  private archiveFailureCode(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('dataset_unavailable'))
        return 'dataset_unavailable';
      if (error.message.includes('dataset_too_large'))
        return 'dataset_too_large';
      if (error.message.includes('Upload failed')) return 'storage_error';
    }
    return 'unknown_error';
  }
}
