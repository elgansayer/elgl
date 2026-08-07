import {
  BadRequestException,
  ConflictException,
  Injectable,
<<<<<<< HEAD
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  EscrowListQueryDto,
} from './dto/escrow.dto';
import {
  EscrowPayment,
  EscrowPaymentListResult,
  EscrowStatus,
} from './interfaces/escrow.interface';

/**
 * Redis cache key prefixes and TTLs for escrow payments.
 *
 * Invalidation strategy:
 *  - Individual escrow detail:  cached for 5 minutes, invalidated on mutation
 *  - User-scoped escrow lists:  cached for 60 seconds to stay fresh while
 *    reducing DB pressure; invalidated on any write affecting that user
 *
 * Every mutation (create / release / refund / cancel / dispute) triggers
 * targeted invalidation for the payer, payee, and individual record keys.
 */
const CACHE_PREFIX_USER_LIST = 'escrow:user:list:';
const CACHE_PREFIX_DETAIL = 'escrow:detail:';
const CACHE_TTL_DETAIL = 300; // 5 minutes
const CACHE_TTL_USER_LIST = 60; // 1 minute

const DEFAULT_HOLD_DAYS = 7;

function isEscrowRow(value: unknown): value is EscrowPayment {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.payer_id === 'string' &&
    typeof r.payee_id === 'string' &&
    typeof r.amount_coins === 'number' &&
    typeof r.status === 'string' &&
    typeof r.reference_type === 'string' &&
    typeof r.reference_id === 'string' &&
    typeof r.held_at === 'string' &&
    typeof r.created_at === 'string'
  );
}
=======
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import {
  EscrowTransaction,
  EscrowStatus,
  EscrowHoldResult,
  EscrowReleaseResult,
} from './interfaces/escrow-transaction.interface';
import {
  CreateEscrowHoldDto,
  EscrowTransactionResponse,
} from './dto/escrow.dto';
import { sanitiseEscrowData } from './sanitise-escrow.helper';

const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
};

const SERVICE_NAME = 'escrow';
>>>>>>> origin/main

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

<<<<<<< HEAD
  constructor(private readonly supabaseService: SupabaseService) {}

  private getRedis(): Redis {
    return this.supabaseService.getRedisClient();
  }

  // ─── Cache Invalidation Rules ──────────────────────────────────────

  /**
   * Invalidates all cached queries that include escrow data for the given
   * user (both as payer and payee) AND the individual escrow detail key.
   *
   * This is the central invalidation point called after every write.
   * By invalidating user-level list caches we ensure the user always sees
   * up-to-date data on their next request, while the individual detail key
   * ensures no stale reads on direct escrow lookups.
   */
  private async invalidateEscrowCaches(
    userIds: string[],
    escrowId?: string,
  ): Promise<void> {
    try {
      const redis = this.getRedis();
      const keysToDelete: string[] = [];

      for (const uid of userIds) {
        const userKeys = await redis.keys(`${CACHE_PREFIX_USER_LIST}${uid}:*`);
        keysToDelete.push(...userKeys);
      }

      if (escrowId) {
        keysToDelete.push(`${CACHE_PREFIX_DETAIL}${escrowId}`);
      }

      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
        this.logger.log(
          `Invalidated ${keysToDelete.length} escrow cache key(s) for users [${userIds.join(', ')}]`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to invalidate escrow caches', err);
    }
  }

  // ─── Public API ────────────────────────────────────────────────────

  /**
   * Creates a new escrow payment, withholding `amount_coins` from the
   * payer's balance and holding them until the payee releases / refunds /
   * cancels, or the hold period expires.
   */
  async createEscrow(
    payerId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowPayment> {
    if (payerId === dto.payee_id) {
      throw new BadRequestException('Cannot create escrow with yourself');
    }

    const supabase = this.supabaseService.getClient();

    // Verify payer has sufficient balance
    const { data: payerData, error: payerError } = await supabase
=======
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Computes exponential backoff delay.
   * delay = min(baseDelay * 2^retryCount, maxDelay)
   */
  private getBackoffDelay(retryCount: number): number {
    const delay = Math.min(
      RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount),
      RETRY_CONFIG.maxDelayMs,
    );
    // Add jitter: +/- 25%
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }

  /**
   * Maps a raw database row to a safe EscrowTransactionResponse.
   */
  private toResponse(
    row: EscrowTransaction,
    degraded = false,
    fallbackReason?: string,
  ): EscrowTransactionResponse {
    return sanitiseEscrowData({
      id: row.id,
      payer_id: row.payer_id,
      payee_id: row.payee_id,
      amount_coins: row.amount_coins,
      status: row.status,
      reason: row.reason,
      metadata: row.metadata || {},
      held_at: row.held_at,
      released_at: row.released_at,
      refunded_at: row.refunded_at,
      cancelled_at: row.cancelled_at,
      retry_count: row.retry_count,
      last_error: row.last_error,
      created_at: row.created_at,
      updated_at: row.updated_at,
      degraded,
      fallback_reason: fallbackReason,
    });
  }

  /**
   * Holds coins in escrow for a future transaction.
   * Deducts coins from payer, creates escrow record, and credits payee on release.
   */
  async holdCoins(
    payerId: string,
    dto: CreateEscrowHoldDto,
  ): Promise<EscrowHoldResult> {
    if (dto.payee_id === payerId) {
      throw new BadRequestException('Cannot create escrow with yourself');
    }

    const degradedMarker = {
      degraded: false,
      reason: undefined as string | undefined,
    };

    const result = await this.circuitBreaker.executeWithBreaker(
      SERVICE_NAME,
      async () => {
        return await this.performHold(payerId, dto);
      },
      async () => {
        return await this.performDegradedHold(payerId, dto);
      },
      degradedMarker,
    );

    return sanitiseEscrowData({
      success: true,
      transaction_id:
        typeof result === 'object' && result !== null && 'id' in result
          ? String(result.id)
          : '',
      degraded: degradedMarker.degraded,
      fallback_reason: degradedMarker.reason,
    });
  }

  private async performHold(
    payerId: string,
    dto: CreateEscrowHoldDto,
  ): Promise<EscrowTransaction> {
    const supabase = this.supabaseService.getClient();

    // Check payer balance
    const { data: payerRow, error: payerError } = await supabase
>>>>>>> origin/main
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

<<<<<<< HEAD
    if (payerError || !payerData) {
      throw new NotFoundException('Payer not found');
    }

    const currentBalance = Number(payerData.coins_balance ?? 0);
    if (currentBalance < dto.amount_coins) {
      throw new BadRequestException(
        `Insufficient coin balance (${currentBalance} available, ${dto.amount_coins} required)`,
      );
    }

    // Verify payee exists
    const { data: payeeData, error: payeeError } = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.payee_id)
      .single();

    if (payeeError || !payeeData) {
      throw new NotFoundException('Payee not found');
    }

    // Deduct coins from payer
    const newBalance = currentBalance - dto.amount_coins;
    const { error: balanceError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', payerId);

    if (balanceError) {
      throw new BadRequestException('Failed to deduct coins from balance');
    }

    // Create escrow record
    const now = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEFAULT_HOLD_DAYS);

    const escrowInsert = {
      payer_id: payerId,
      payee_id: dto.payee_id,
      amount_coins: dto.amount_coins,
      status: EscrowStatus.HELD,
      reference_type: dto.reference_type,
      reference_id: dto.reference_id,
      held_at: now,
      expires_at: expiresAt.toISOString(),
      metadata: dto.metadata ? JSON.parse(dto.metadata) : null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('escrow_payments')
      .insert(escrowInsert)
      .select('*')
      .single();

    if (insertError || !inserted) {
      // Rollback coin deduction
      await supabase
        .from('users')
        .update({ coins_balance: currentBalance })
        .eq('id', payerId);
      throw new BadRequestException('Failed to create escrow payment');
    }

    if (!isEscrowRow(inserted)) {
      throw new BadRequestException('Invalid escrow data returned');
    }

    // Invalidate caches for both payer and payee
    await this.invalidateEscrowCaches([payerId, dto.payee_id], inserted.id);

    return inserted;
  }

  /**
   * Releases (pays out to payee), refunds (returns to payer), or cancels
   * a held escrow.  Only the payee may release; only the payer may refund
   * or cancel.
   */
  async resolveEscrow(
    escrowId: string,
    actingUserId: string,
    dto: ReleaseEscrowDto,
  ): Promise<EscrowPayment> {
    const supabase = this.supabaseService.getClient();

    const escrow = await this.getEscrowByIdInternal(escrowId);
    if (!escrow) {
      throw new NotFoundException(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== EscrowStatus.HELD) {
      throw new ConflictException(
        `Escrow ${escrowId} is already ${escrow.status}`,
      );
    }

    const now = new Date().toISOString();
    let newStatus: EscrowStatus;
    let recipientId: string;
    // Coins to credit to whoever should receive them
    let creditUserId: string | null = null;

    switch (dto.action) {
      case 'release': {
        if (actingUserId !== escrow.payee_id) {
          throw new BadRequestException('Only the payee may release escrow');
        }
        newStatus = EscrowStatus.RELEASED;
        creditUserId = escrow.payee_id;
        break;
      }
      case 'refund': {
        if (
          actingUserId !== escrow.payee_id &&
          actingUserId !== escrow.payer_id
        ) {
          throw new BadRequestException(
            'Only the payer or payee may request a refund',
          );
        }
        newStatus = EscrowStatus.REFUNDED;
        creditUserId = escrow.payer_id;
        break;
      }
      case 'cancel': {
        if (actingUserId !== escrow.payer_id) {
          throw new BadRequestException('Only the payer may cancel escrow');
        }
        newStatus = EscrowStatus.CANCELLED;
        creditUserId = escrow.payer_id;
        break;
      }
      default:
        throw new BadRequestException(`Unknown action: ${dto.action}`);
    }

    if (creditUserId) {
      // Fetch current balance and increment
      const { data: balanceRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', creditUserId)
        .single();

      const currentRecipientBalance = Number(balanceRow?.coins_balance ?? 0);
      const newRecipientBalance = currentRecipientBalance + escrow.amount_coins;

      const { error: creditError } = await supabase
        .from('users')
        .update({ coins_balance: newRecipientBalance })
        .eq('id', creditUserId);

      if (creditError) {
        throw new BadRequestException('Failed to credit coins');
      }
    }

    // Update escrow status
    const nowISO = new Date().toISOString();
    const updatePayload: {
      status: string;
      updated_at: string;
      released_at?: string | null;
      refunded_at?: string | null;
      cancelled_at?: string | null;
    } = {
      status: newStatus,
      updated_at: nowISO,
    };
    if (newStatus === EscrowStatus.RELEASED) {
      updatePayload.released_at = nowISO;
    }
    if (newStatus === EscrowStatus.REFUNDED) {
      updatePayload.refunded_at = nowISO;
    }
    if (newStatus === EscrowStatus.CANCELLED) {
      updatePayload.cancelled_at = nowISO;
    }

    const { data: updated, error: updateError } = await supabase
      .from('escrow_payments')
      .update(updatePayload)
      .eq('id', escrowId)
=======
    if (payerError || !payerRow) {
      throw new NotFoundException('Payer not found');
    }

    const payerBalance = (payerRow as { coins_balance: number }).coins_balance;
    if (payerBalance < dto.amount_coins) {
      throw new BadRequestException(
        `Insufficient balance: have ${payerBalance} coins, need ${dto.amount_coins}`,
      );
    }

    // Deduct coins from payer
    const { error: deductError } = await supabase
      .from('users')
      .update({ coins_balance: payerBalance - dto.amount_coins })
      .eq('id', payerId);

    if (deductError) {
      this.logger.error(
        `Failed to deduct coins from ${payerId}: ${deductError.message}`,
      );
      throw new InternalServerErrorException('Failed to hold coins');
    }

    // Create escrow transaction
    const now = new Date().toISOString();
    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
        status: 'held' as EscrowStatus,
        reason: dto.reason,
        metadata: dto.metadata || {},
        held_at: now,
        retry_count: 0,
      } as never)
      .select('*')
      .single();

    if (txError || !txRow) {
      // Refund the deducted coins on failure
      await supabase
        .from('users')
        .update({ coins_balance: payerBalance })
        .eq('id', payerId);
      this.logger.error(
        `Failed to create escrow transaction: ${txError?.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to create escrow transaction',
      );
    }

    this.logger.log(
      `Escrow hold: ${dto.amount_coins} coins from ${payerId} to ${dto.payee_id} for "${dto.reason}"`,
    );

    return txRow;
  }

  /**
   * Degraded hold: When the database is unavailable, we log the intent
   * and queue for later processing via a Redis-based pending queue.
   */
  private async performDegradedHold(
    payerId: string,
    dto: CreateEscrowHoldDto,
  ): Promise<EscrowTransaction> {
    const redis = this.supabaseService.getRedisClient();
    const id = `degraded_escrow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const degradedRecord = {
      id,
      payer_id: payerId,
      payee_id: dto.payee_id,
      amount_coins: dto.amount_coins,
      status: 'pending' as EscrowStatus,
      reason: dto.reason,
      metadata: dto.metadata || {},
      degraded: true,
      created_at: new Date().toISOString(),
    };

    try {
      await redis.lpush(
        'escrow_degraded_queue',
        JSON.stringify(degradedRecord),
      );
    } catch (redisError: unknown) {
      this.logger.error(
        `Failed to enqueue degraded escrow: ${redisError instanceof Error ? redisError.message : String(redisError)}`,
      );
    }

    this.logger.warn(
      `Degraded escrow hold queued: ${dto.amount_coins} coins from ${payerId} to ${dto.payee_id}`,
    );

    const now = new Date().toISOString();
    return {
      id,
      payer_id: payerId,
      payee_id: dto.payee_id,
      amount_coins: dto.amount_coins,
      status: 'pending',
      reason: dto.reason,
      metadata: dto.metadata || {},
      held_at: null,
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Releases held escrow coins to the payee.
   */
  async releaseCoins(
    transactionId: string,
    userId: string,
  ): Promise<EscrowReleaseResult> {
    const degradedMarker = {
      degraded: false,
      reason: undefined as string | undefined,
    };

    const result = await this.circuitBreaker.executeWithBreaker(
      SERVICE_NAME,
      async () => {
        return await this.performRelease(transactionId, userId);
      },
      async () => {
        return await this.performDegradedRelease(transactionId, userId);
      },
      degradedMarker,
    );

    return sanitiseEscrowData({
      success: true,
      transaction_id: result.id,
      degraded: degradedMarker.degraded,
      fallback_reason: degradedMarker.reason,
    });
  }

  private async performRelease(
    transactionId: string,
    userId: string,
  ): Promise<EscrowTransaction> {
    const supabase = this.supabaseService.getClient();

    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !txRow) {
      throw new NotFoundException('Escrow transaction not found');
    }

    const tx = txRow as EscrowTransaction;

    if (tx.status !== 'held') {
      throw new ConflictException(
        `Cannot release escrow with status "${tx.status}"`,
      );
    }

    if (tx.payer_id !== userId) {
      throw new BadRequestException('Only the payer can release escrow funds');
    }

    // Credit coins to payee
    const { data: payeeRow, error: payeeError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', tx.payee_id)
      .single();

    if (payeeError || !payeeRow) {
      throw new NotFoundException('Payee not found');
    }

    const payeeBalance = (payeeRow as { coins_balance: number }).coins_balance;
    const { error: creditError } = await supabase
      .from('users')
      .update({ coins_balance: payeeBalance + tx.amount_coins })
      .eq('id', tx.payee_id);

    if (creditError) {
      this.logger.error(
        `Failed to credit payee ${tx.payee_id} for escrow ${transactionId}: ${creditError.message}`,
      );
      throw new InternalServerErrorException('Failed to credit payee');
    }

    // Mark transaction as released
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('escrow_transactions' as never)
      .update({
        status: 'released' as EscrowStatus,
        released_at: now,
      } as never)
      .eq('id', transactionId)
>>>>>>> origin/main
      .select('*')
      .single();

    if (updateError || !updated) {
<<<<<<< HEAD
      throw new BadRequestException('Failed to update escrow status');
    }

    if (!isEscrowRow(updated)) {
      throw new BadRequestException('Invalid escrow data returned');
    }

    // Invalidate caches for both parties
    await this.invalidateEscrowCaches(
      [escrow.payer_id, escrow.payee_id],
      escrowId,
=======
      this.logger.error(
        `Failed to update escrow ${transactionId} status to released: ${updateError?.message ?? 'invalid data returned'}`,
      );
      throw new InternalServerErrorException('Failed to update escrow status');
    }

    this.logger.log(
      `Escrow released: ${transactionId} - ${tx.amount_coins} coins to ${tx.payee_id}`,
>>>>>>> origin/main
    );

    return updated;
  }

<<<<<<< HEAD
  /**
   * Fetches a single escrow by ID, with Redis read-through caching.
   */
  async getEscrowById(escrowId: string): Promise<EscrowPayment> {
    const cacheKey = `${CACHE_PREFIX_DETAIL}${escrowId}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (isEscrowRow(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to read escrow cache for ${escrowId}`, err);
    }

    const escrow = await this.getEscrowByIdInternal(escrowId);
    if (!escrow) {
      throw new NotFoundException(`Escrow ${escrowId} not found`);
    }

    try {
      const redis = this.getRedis();
      await redis.set(cacheKey, JSON.stringify(escrow), 'EX', CACHE_TTL_DETAIL);
    } catch (err) {
      this.logger.warn(`Failed to cache escrow ${escrowId}`, err);
    }

    return escrow;
  }

  /**
   * Lists escrow payments for a user (as payer or payee), with Redis
   * read-through caching and TTL-based freshness.
   */
  async listEscrows(
    userId: string,
    query: EscrowListQueryDto,
  ): Promise<EscrowPaymentListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const role = query.role ?? 'payer';
    const status = query.status ?? '';

    const cacheKey = `${CACHE_PREFIX_USER_LIST}${userId}:${role}:${status}:${page}:${pageSize}`;

    try {
      const redis = this.getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'payments' in parsed &&
          'total' in parsed
        ) {
          return parsed as EscrowPaymentListResult;
        }
      }
    } catch (err) {
      this.logger.warn(
        `Failed to read escrow list cache for user ${userId}`,
        err,
      );
    }

    const supabase = this.supabaseService.getClient();
    const column = role === 'payer' ? 'payer_id' : 'payee_id';
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = supabase
      .from('escrow_payments')
      .select('*', { count: 'exact' })
      .eq(column, userId);

    if (status) {
      request = request.eq('status', status);
    }

    const { data, error, count } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      this.logger.warn(
        `Failed to fetch escrow list for user ${userId}: ${error.message}`,
      );
      return { payments: [], total: 0, page, pageSize };
    }

    const payments: EscrowPayment[] = (data ?? []).filter(
      (row): row is EscrowPayment => isEscrowRow(row),
    );

    const result: EscrowPaymentListResult = {
      payments,
      total: count ?? 0,
      page,
      pageSize,
    };

    try {
      const redis = this.getRedis();
      await redis.set(
        cacheKey,
        JSON.stringify(result),
        'EX',
        CACHE_TTL_USER_LIST,
      );
    } catch (err) {
      this.logger.warn(`Failed to cache escrow list for user ${userId}`, err);
    }

    return result;
  }

  // ─── Internal Helpers ──────────────────────────────────────────────

  private async getEscrowByIdInternal(
    escrowId: string,
  ): Promise<EscrowPayment | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
      return null;
    }

    if (!isEscrowRow(data)) {
      return null;
    }

    return data;
=======
  private async performDegradedRelease(
    transactionId: string,
    _userId: string,
  ): Promise<EscrowTransaction> {
    this.logger.warn(`Degraded escrow release queued for: ${transactionId}`);
    const redis = this.supabaseService.getRedisClient();
    try {
      await redis.lpush(
        'escrow_release_queue',
        JSON.stringify({ transactionId, timestamp: new Date().toISOString() }),
      );
    } catch (redisError: unknown) {
      this.logger.error(
        `Failed to enqueue degraded escrow release: ${redisError instanceof Error ? redisError.message : String(redisError)}`,
      );
    }

    const now = new Date().toISOString();
    return {
      id: transactionId,
      payer_id: '',
      payee_id: '',
      amount_coins: 0,
          status: 'held' as EscrowStatus,
      reason: 'Processing delayed - queued for retry',
      metadata: {},
      held_at: now,
      released_at: null,
      refunded_at: null,
      cancelled_at: null,
      retry_count: 0,
      last_error: null,
      next_retry_at: now,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Refunds escrow coins back to the payer.
   */
  async refundCoins(
    transactionId: string,
    userId: string,
    reason?: string,
  ): Promise<EscrowTransactionResponse> {
    const degradedMarker = {
      degraded: false,
      reason: undefined as string | undefined,
    };

    const result = await this.circuitBreaker.executeWithBreaker(
      SERVICE_NAME,
      async () => {
        const supabase = this.supabaseService.getClient();

        const { data: txRow, error: txError } = await supabase
          .from('escrow_transactions' as never)
          .select('*')
          .eq('id', transactionId)
          .single();

        if (txError || !txRow) {
          throw new NotFoundException('Escrow transaction not found');
        }

        const tx = txRow as EscrowTransaction;

        if (tx.status !== 'held' && tx.status !== 'pending') {
          throw new ConflictException(
            `Cannot refund escrow with status "${tx.status}"`,
          );
        }

        if (tx.payer_id !== userId) {
          throw new BadRequestException(
            'Only the payer can refund escrow funds',
          );
        }

        // Refund coins to payer
        const { data: payerRow, error: payerError } = await supabase
          .from('users')
          .select('coins_balance')
          .eq('id', tx.payer_id)
          .single();

        if (payerError || !payerRow) {
          throw new NotFoundException('Payer not found');
        }

        const payerBalance = (payerRow as { coins_balance: number })
          .coins_balance;
        const { error: refundError } = await supabase
          .from('users')
          .update({ coins_balance: payerBalance + tx.amount_coins })
          .eq('id', tx.payer_id);

        if (refundError) {
          this.logger.error(
            `Failed to refund payer ${tx.payer_id} for escrow ${transactionId}: ${refundError.message}`,
          );
          throw new InternalServerErrorException('Failed to refund payer');
        }

        const now = new Date().toISOString();
        const { data: updated, error: updateError } = await supabase
          .from('escrow_transactions' as never)
          .update({
            status: 'refunded' as EscrowStatus,
            refunded_at: now,
            metadata: {
              ...tx.metadata,
              refund_reason: reason || 'Refund requested by payer',
            },
          } as never)
          .eq('id', transactionId)
          .select('*')
          .single();

        if (updateError || !updated) {
          this.logger.error(
            `Failed to update escrow ${transactionId} status to refunded: ${updateError?.message ?? 'invalid data returned'}`,
          );
          throw new InternalServerErrorException(
            'Failed to update escrow status',
          );
        }

        this.logger.log(
          `Escrow refunded: ${transactionId} - ${tx.amount_coins} coins to ${tx.payer_id}`,
        );

        return updated;
      },
      async () => {
        this.logger.warn(`Degraded escrow refund queued for: ${transactionId}`);
        const redis = this.supabaseService.getRedisClient();
        try {
          await redis.lpush(
            'escrow_refund_queue',
            JSON.stringify({
              transactionId,
              reason,
              timestamp: new Date().toISOString(),
            }),
          );
        } catch (redisError: unknown) {
          this.logger.error(
            `Failed to enqueue degraded refund: ${redisError instanceof Error ? redisError.message : String(redisError)}`,
          );
        }

        const now = new Date().toISOString();
        const degradedTx: EscrowTransaction = {
          id: transactionId,
          payer_id: '',
          payee_id: '',
          amount_coins: 0,
          status: 'held' as EscrowStatus,
          reason: 'Refund delayed - queued for retry',
          metadata: {},
          held_at: now,
          released_at: null,
          refunded_at: null,
          cancelled_at: null,
          retry_count: 0,
          last_error: null,
          next_retry_at: now,
          created_at: now,
          updated_at: now,
        };
        return degradedTx;
      },
      degradedMarker,
    );

    return this.toResponse(
      result as EscrowTransaction,
      degradedMarker.degraded,
      degradedMarker.reason,
    );
  }

  /**
   * Cancels an escrow transaction that hasn't been held yet.
   */
  async cancelEscrow(
    transactionId: string,
    userId: string,
  ): Promise<EscrowTransactionResponse> {
    const supabase = this.supabaseService.getClient();

    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !txRow) {
      throw new NotFoundException('Escrow transaction not found');
    }

    const tx = txRow as EscrowTransaction;

    if (tx.status === 'released') {
      throw new ConflictException('Cannot cancel a released escrow');
    }

    if (tx.payer_id !== userId && tx.payee_id !== userId) {
      throw new BadRequestException('Not authorised to cancel this escrow');
    }

    // If held, refund the coins
    if (tx.status === 'held') {
      const { data: payerRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', tx.payer_id)
        .single();

      if (payerRow) {
        const payerBalance = (payerRow as { coins_balance: number })
          .coins_balance;
        const { error: refundError } = await supabase
          .from('users')
          .update({ coins_balance: payerBalance + tx.amount_coins })
          .eq('id', tx.payer_id);

        if (refundError) {
          this.logger.warn(
            `Failed to refund payer ${tx.payer_id} during cancel of escrow ${transactionId}: ${refundError.message}`,
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('escrow_transactions' as never)
      .update({
        status: 'cancelled' as EscrowStatus,
        cancelled_at: now,
      } as never)
      .eq('id', transactionId)
      .select('*')
      .single();

    if (updateError || !updated) {
      this.logger.error(
        `Failed to update escrow ${transactionId} status to cancelled: ${updateError?.message ?? 'invalid data returned'}`,
      );
      throw new InternalServerErrorException('Failed to cancel escrow');
    }

    this.logger.log(`Escrow cancelled: ${transactionId}`);

    return this.toResponse(updated);
  }

  /**
   * Retrieves an escrow transaction by ID.
   */
  async getTransaction(
    transactionId: string,
    userId: string,
  ): Promise<EscrowTransactionResponse> {
    const supabase = this.supabaseService.getClient();

    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !txRow) {
      // Try degraded queue as fallback
      return this.findInDegradedQueue(transactionId);
    }

    const tx = txRow as EscrowTransaction;

    if (tx.payer_id !== userId && tx.payee_id !== userId) {
      throw new BadRequestException('Not authorised to view this escrow');
    }

    return this.toResponse(tx);
  }

  /**
   * Lists escrow transactions for a user.
   */
  async listTransactions(
    userId: string,
    status?: EscrowStatus,
    limit = 20,
    offset = 0,
  ): Promise<EscrowTransactionResponse[]> {
    const supabase = this.supabaseService.getClient();

    let query = supabase
      .from('escrow_transactions' as never)
      .select('*')
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error || !data) {
      this.logger.error(
        `Failed to list escrow transactions for ${userId}: ${error?.message ?? 'no data returned'}`,
      );
      return [];
    }

    return (data as EscrowTransaction[]).map((tx) => this.toResponse(tx));
  }

  /**
   * Processes the degraded queue, retrying failed escrow operations
   * with exponential backoff.
   */
  async processDegradedQueue(): Promise<{
    processed: number;
    failed: number;
  }> {
    const redis = this.supabaseService.getRedisClient();
    let processed = 0;
    let failed = 0;

    try {
      const items = await redis.lrange('escrow_degraded_queue', 0, -1);

      for (const raw of items) {
        try {
          const record = JSON.parse(raw) as EscrowTransaction & {
            degraded?: boolean;
          };
          if (
            record.status === 'pending' &&
            record.payer_id &&
            record.payee_id
          ) {
            await this.retryWithBackoff(async () => {
              const dto: CreateEscrowHoldDto = {
                payee_id: record.payee_id,
                amount_coins: record.amount_coins,
                reason: record.reason,
                metadata: record.metadata,
              };
              return await this.performHold(record.payer_id, dto);
            });
            processed += 1;
          }
        } catch (error: unknown) {
          failed += 1;
          this.logger.error(
            `Failed to process degraded escrow: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      // Clear processed items
      if (processed > 0) {
        await redis.ltrim('escrow_degraded_queue', failed, -1);
      }
    } catch (redisError: unknown) {
      this.logger.error(
        `Failed to access degraded queue: ${redisError instanceof Error ? redisError.message : String(redisError)}`,
      );
    }

    return sanitiseEscrowData({ processed, failed });
  }

  /**
   * Retries an operation with exponential backoff.
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = RETRY_CONFIG.maxRetries,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          const delay = this.getBackoffDelay(attempt);
          this.logger.warn(
            `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError.message}`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Tries to find a transaction in the degraded queues.
   */
  private async findInDegradedQueue(
    transactionId: string,
  ): Promise<EscrowTransactionResponse> {
    const redis = this.supabaseService.getRedisClient();

    try {
      const items = await redis.lrange('escrow_degraded_queue', 0, -1);
      for (const raw of items) {
        const record = JSON.parse(raw) as EscrowTransaction;
        if (record.id === transactionId) {
          return this.toResponse(
            record,
            true,
            'Transaction queued for processing',
          );
        }
      }
    } catch {
      // Silently skip Redis errors in fallback lookup
    }

    throw new NotFoundException('Escrow transaction not found');
  }

  /**
   * Returns the circuit breaker status for the escrow service.
   */
  getCircuitBreakerStatus() {
    return {
      service: SERVICE_NAME,
      ...this.circuitBreaker.getState(SERVICE_NAME),
    };
  }

  /**
   * Resets the circuit breaker for the escrow service.
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset(SERVICE_NAME);
>>>>>>> origin/main
  }
}
