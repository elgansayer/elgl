import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { SafetyCacheInvalidationService } from '../safety/safety-cache-invalidation.service';
import { ArchiveRequestDto } from './dto/archive-request.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import {
  scrubCoinPurchasesForArchive,
  scrubEscrowTransactionsForArchive,
} from '../economy/sanitise-economy.helper';

const ARCHIVE_BUCKET = 'gdpr-archives';
const ARCHIVE_PAGE_SIZE = 500;
const MAX_ROWS_PER_DATASET = 50_000;
const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_SIGNED_URL_SECONDS = 300;

type ArchiveStatus = 'processing' | 'ready' | 'failed' | 'expired';

interface ArchiveRequestRow {
  id: string;
  user_id: string;
  status: ArchiveStatus;
  object_key: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface ArchiveRequestResult {
  request_id: string;
  status: 'processing' | 'ready';
  download_url?: string;
  expires_at?: string;
}

interface PageResult {
  data: unknown[] | null;
  error: { message?: string } | null;
}

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly safetyCacheService: SafetyCacheInvalidationService,
  ) {}

  async requestArchive(
    userId: string,
    dto: ArchiveRequestDto,
  ): Promise<ArchiveRequestResult> {
    const supabase = this.supabaseService.getClient();
    const now = new Date();

    // Reuse a recent in-flight or ready export. This keeps retries idempotent and
    // avoids repeatedly collecting large private datasets.
    const { data: latestRaw, error: latestError } = await supabase
      .from('archive_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      this.logger.error('gdpr_archive_lookup_failed');
      throw new ServiceUnavailableException('Unable to prepare data archive');
    }

    const latest = latestRaw as unknown as ArchiveRequestRow | null;
    if (latest?.status === 'processing') {
      return { request_id: latest.id, status: 'processing' };
    }

    if (
      latest?.status === 'ready' &&
      latest.object_key &&
      latest.expires_at &&
      new Date(latest.expires_at).getTime() > now.getTime()
    ) {
      return this.signReadyArchive(latest);
    }

    const requestId = randomUUID();
    const objectKey = `${randomUUID()}.json`;
    const expiresAt = new Date(
      now.getTime() + this.archiveRetentionDays() * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase
      .from('archive_requests')
      .insert({
        id: requestId,
        user_id: userId,
        requested_at: now.toISOString(),
        status: 'processing',
        object_key: null,
        expires_at: expiresAt,
        archive_url: null,
        failure_code: null,
        updated_at: now.toISOString(),
        receipt_id: dto.receipt_id ?? null,
        app_store: dto.app_store ?? null,
      } as never);

    if (insertError) {
      // A concurrent request may have won the one-processing-row constraint.
      // Returning processing is retry-safe and does not expose provider details.
      if ((insertError as { code?: string }).code === '23505') {
        const { data: concurrentRaw } = await supabase
          .from('archive_requests')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const concurrent = concurrentRaw as unknown as ArchiveRequestRow | null;
        if (concurrent?.status === 'processing') {
          return { request_id: concurrent.id, status: 'processing' };
        }
      }

      this.logger.error('gdpr_archive_request_insert_failed');
      throw new ServiceUnavailableException('Unable to prepare data archive');
    }

    let uploaded = false;
    try {
      const userData = await this.collectUserData(userId);
      const jsonBlob = JSON.stringify(userData, null, 2);

      const { error: uploadError } = await supabase.storage
        .from(ARCHIVE_BUCKET)
        .upload(objectKey, jsonBlob, {
          contentType: 'application/json',
          upsert: false,
        });

      if (uploadError) {
        throw new Error('archive_upload_failed');
      }
      uploaded = true;

      const fulfilledAt = new Date().toISOString();
      const { error: readyError } = await supabase
        .from('archive_requests')
        .update({
          status: 'ready',
          object_key: objectKey,
          archive_url: null,
          fulfilled_at: fulfilledAt,
          failure_code: null,
          updated_at: fulfilledAt,
        } as never)
        .eq('id', requestId)
        .eq('user_id', userId);

      if (readyError) {
        throw new Error('archive_state_update_failed');
      }

      this.logger.log('gdpr_archive_ready');
      return this.signReadyArchive({
        id: requestId,
        user_id: userId,
        status: 'ready',
        object_key: objectKey,
        expires_at: expiresAt,
        created_at: now.toISOString(),
      });
    } catch (error) {
      if (uploaded) {
        await supabase.storage.from(ARCHIVE_BUCKET).remove([objectKey]);
      }

      await supabase
        .from('archive_requests')
        .update({
          status: 'failed',
          object_key: null,
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
    let purged = 0;

    // ⚡ Bolt Optimization: Replaced sequential await loop with Promise.allSettled chunks
    // to process batch deletions and metadata updates concurrently without exhausting
    // database connections, significantly reducing query latency for cleanup jobs.
    const chunkSize = 10;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      await Promise.allSettled(
        chunk.map(async (row) => {
          if (row.object_key) {
            const { error: removeError } = await supabase.storage
              .from(ARCHIVE_BUCKET)
              .remove([row.object_key]);
            if (removeError) {
              this.logger.error('gdpr_archive_cleanup_object_failed');
              throw removeError;
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
            throw updateError;
          }

          purged += 1;
        }),
      );
    }

    if (purged > 0)
      this.logger.log(`gdpr_archive_cleanup_complete count=${purged}`);
    return purged;
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    if (!dto.confirm_delete) {
      throw new BadRequestException('You must confirm account deletion');
    }

    const supabase = this.supabaseService.getClient();
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

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
      this.logger.error('gdpr_account_deletion_schedule_failed');
      throw new ServiceUnavailableException(
        'Failed to initiate account deletion',
      );
    }

    await this.safetyCacheService.invalidateUserCaches(userId);
    this.logger.log('gdpr_account_deletion_scheduled');
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
      this.logger.error('gdpr_account_deletion_cancel_failed');
      throw new ServiceUnavailableException(
        'Failed to cancel account deletion',
      );
    }

    this.logger.log('gdpr_account_deletion_cancelled');
  }

  private async signReadyArchive(
    row: ArchiveRequestRow,
  ): Promise<ArchiveRequestResult> {
    if (!row.object_key || !row.expires_at) {
      throw new ServiceUnavailableException('Archive is not available');
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase.storage
      .from(ARCHIVE_BUCKET)
      .createSignedUrl(row.object_key, this.signedUrlSeconds());

    if (error || !data?.signedUrl) {
      this.logger.error('gdpr_archive_sign_failed');
      throw new ServiceUnavailableException('Archive is not available');
    }

    return {
      request_id: row.id,
      status: 'ready',
      download_url: data.signedUrl,
      expires_at: row.expires_at,
    };
  }

  private async collectUserData(
    userId: string,
  ): Promise<Record<string, unknown>> {
    const supabase = this.supabaseService.getClient();
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(
        'id, display_name, native_language, target_languages, bio_text, avatar_url, audio_intro_url, location, mock_location, is_vip, vip_tier, coins_balance, study_streak_days, correction_ratio, is_serious_learner, privacy_hide_from_search, privacy_hide_location, is_deletion_pending, created_at',
      )
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      this.logger.error('gdpr_archive_profile_fetch_failed');
      throw new Error('required_profile_unavailable');
    }

    const [
      moments,
      momentComments,
      chatMessages,
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
          .eq('user_id', userId)
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
      this.fetchPaged('escrow_as_payer', async (from, to) => {
        const result = await supabase
          .from('escrow_transactions')
          .select('*')
          .eq('payer_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('escrow_as_payee', async (from, to) => {
        const result = await supabase
          .from('escrow_transactions')
          .select('*')
          .eq('payee_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('sent_gifts', async (from, to) => {
        const result = await supabase
          .from('gift_transactions')
          .select('*')
          .eq('sender_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('received_gifts', async (from, to) => {
        const result = await supabase
          .from('gift_transactions')
          .select('*')
          .eq('receiver_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);
        return { data: result.data as unknown[] | null, error: result.error };
      }),
      this.fetchPaged('sticker_packs', async (from, to) => {
        const result = await supabase
          .from('user_sticker_packs')
          .select('*')
          .eq('user_id', userId)
          .order('unlocked_at', { ascending: false })
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
    ];
    const giftTransactions = [
      ...(sentGifts as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        direction: 'sent',
      })),
      ...(receivedGifts as Array<Record<string, unknown>>).map((entry) => ({
        ...entry,
        direction: 'received',
      })),
    ];

    return {
      export_schema_version: 2,
      export_generated_at: new Date().toISOString(),
      user_profile: profile,
      moments,
      moment_comments: momentComments,
      chat_messages: chatMessages,
      flashcards,
      decks,
      deck_flashcards: deckFlashcards,
      favourites,
      coin_purchases: scrubCoinPurchasesForArchive(coinPurchases),
      escrow_transactions: scrubEscrowTransactionsForArchive(
        escrowTransactions,
        userId,
      ),
      gift_transactions: giftTransactions,
      user_sticker_packs: stickerPacks,
      reading_progress: readingProgress ?? null,
      reading_resources: readingResources,
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

  private signedUrlSeconds(): number {
    return this.boundedConfigNumber(
      'GDPR_ARCHIVE_SIGNED_URL_SECONDS',
      DEFAULT_SIGNED_URL_SECONDS,
      60,
      900,
    );
  }

  private boundedConfigNumber(
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const configured = Number(this.configService.get<string | number>(key));
    if (!Number.isFinite(configured)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(configured)));
  }

  private archiveFailureCode(error: unknown): string {
    if (!(error instanceof Error)) return 'unknown';
    if (error.message === 'dataset_too_large') return 'dataset_too_large';
    if (error.message === 'dataset_unavailable') return 'dataset_unavailable';
    if (error.message === 'required_profile_unavailable') {
      return 'profile_unavailable';
    }
    if (error.message === 'archive_upload_failed') return 'storage_unavailable';
    if (error.message === 'archive_state_update_failed') {
      return 'persistence_unavailable';
    }
    return 'unknown';
  }
}
