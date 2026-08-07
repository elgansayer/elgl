import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
<<<<<<< HEAD
import { MonetisationService } from '../monetisation/monetisation.service';
import { RetryService } from '../common/retry/retry.service';
import {
  EscrowTransaction,
  EscrowStatus,
  CreateEscrowResult,
  ReleaseEscrowResult,
  RefundEscrowResult,
  ReconcileEscrowResult,
} from './interfaces/escrow.interface';
import { CreateEscrowDto } from './dto/escrow.dto';

/** Maximum items per page to bound payload sizes (audit #2396). */
const MAX_LIST_LIMIT = 50;
/** Expiry cleanup interval in ms (6 hours). */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Max records to process per expiry cleanup batch. */
const CLEANUP_BATCH_SIZE = 100;
/** Max retry attempts for coin operations during graceful degradation. */
const COIN_OP_MAX_RETRIES = 3;
=======
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

  constructor(
    private readonly supabaseService: SupabaseService,
<<<<<<< HEAD
    private readonly monetisationService: MonetisationService,
    private readonly retryService: RetryService,
  ) {
    // Periodic cleanup of stale held escrows and degraded escrows
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEscrows().catch((err: unknown) => {
        this.logger.error(
          `Escrow expiry cleanup failed: ${(err as Error)?.message ?? 'unknown'}`,
        );
      });
    }, CLEANUP_INTERVAL_MS);
  }
=======
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly configService: ConfigService,
  ) {}
>>>>>>> origin/main

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
<<<<<<< HEAD
   * Create an escrow transaction: lock the payer's coins until the payee
   * fulfills their obligation or the escrow is refunded.
   *
   * Idempotency: if an idempotency_key is provided, duplicate submissions
   * for the same payer+key will return the existing escrow instead of
   * creating a duplicate.
=======
   * Maps a raw database row to a safe EscrowTransactionResponse.
>>>>>>> origin/main
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
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

    if (payerError || !payerRow) {
      throw new NotFoundException('Payer not found');
    }

    const payerBalance = (payerRow as { coins_balance: number }).coins_balance;
    if (payerBalance < dto.amount_coins) {
      throw new BadRequestException(
        `Insufficient balance: have ${payerBalance} coins, need ${dto.amount_coins}`,
      );
    }

<<<<<<< HEAD
    const supabase = this.supabaseService.getClient();

    // Idempotency check: if key provided, check for existing transaction
    if (dto.idempotency_key) {
      const { data: existing } = await supabase
        .from('escrow_transactions')
        .select(
          'id, payer_id, payee_id, amount_coins, status, created_at, updated_at',
        )
        .eq('payer_id', payerId)
        .eq('reference_id', `idem-${dto.idempotency_key}`)
        .maybeSingle();

      if (existing) {
        this.logger.log(
          `Idempotent escrow creation: returning existing escrow ${existing.id} for key ${dto.idempotency_key}`,
        );

        const balance = await this.monetisationService.getCoinsBalance(payerId);
        return {
          id: existing.id,
          status: existing.status,
          amount_coins: existing.amount_coins,
          payer_balance: balance,
        };
      }
    }

    // Verify payee exists
    const { data: payee, error: payeeError } = await supabase
=======
    // Deduct coins from payer
    const { error: deductError } = await supabase
>>>>>>> origin/main
      .from('users')
      .update({ coins_balance: payerBalance - dto.amount_coins })
      .eq('id', payerId);

    if (deductError) {
      this.logger.error(
        `Failed to deduct coins from ${payerId}: ${deductError.message}`,
      );
      throw new InternalServerErrorException('Failed to hold coins');
    }

<<<<<<< HEAD
    // Deduct coins from payer (this validates sufficient balance)
    const payerBalance = await this.monetisationService.deductCoins(
      payerId,
      dto.amount_coins,
    );

    // Build reference_id: use idempotency_key if provided, else client reference
    const idemRef = dto.idempotency_key
      ? `idem-${dto.idempotency_key}`
      : (dto.reference_id ?? null);

    // Create the escrow record
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow_transactions')
=======
    // Create escrow transaction
    const now = new Date().toISOString();
    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
>>>>>>> origin/main
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
        status: 'held' as EscrowStatus,
<<<<<<< HEAD
        description: dto.description ?? null,
        reference_id: idemRef,
      })
      .select(
        'id, payer_id, payee_id, amount_coins, status, description, reference_id, created_at, updated_at',
      )
      .single();

    if (escrowError || !escrow) {
      // Refund coins if escrow record creation fails - with retry for resilience
      this.logger.error(
        `Failed to create escrow record: ${escrowError?.message}, refunding coins to payer ${payerId}`,
      );
      try {
        await this.retryService.withRetry(
          () => this.monetisationService.addCoins(payerId, dto.amount_coins),
          { maxRetries: COIN_OP_MAX_RETRIES, baseDelayMs: 500 },
        );
      } catch (refundErr: unknown) {
        this.logger.error(
          `CRITICAL: Failed to refund coins after escrow insert failure for payer ${payerId}: ${(refundErr as Error)?.message ?? 'unknown'}`,
        );
      }
      throw new BadRequestException('Failed to create escrow transaction.');
    }

    this.logger.log(
      `Escrow created: ${escrow.id}, amount=${dto.amount_coins} coins, payer=${payerId}, payee=${dto.payee_id}`,
    );

    return {
      id: escrow.id,
      status: escrow.status,
      amount_coins: escrow.amount_coins,
      payer_balance: payerBalance,
    };
  }

  /**
   * Release escrowed coins to the payee. Only the payer can release.
   *
   * Graceful degradation: the escrow is first set to 'release_pending',
   * then the coin transfer is attempted with retries. If the transfer
   * ultimately fails, the escrow stays in 'release_pending' for
   * reconciliation rather than silently losing coins.
   */
  async releaseEscrow(
    userId: string,
    escrowId: string,
  ): Promise<ReleaseEscrowResult> {
    const escrow = await this.findEscrowOrThrow(escrowId);

    if (escrow.payer_id !== userId) {
      throw new ForbiddenException(
        'Only the payer can release escrowed funds.',
      );
    }

    if (escrow.status === 'release_pending') {
      return this.finaliseReleaseEscrow(escrow);
    }

    if (escrow.status !== 'held') {
      throw new ConflictException(
        `Escrow is not in 'held' status (current: ${escrow.status}).`,
      );
    }

    return this.performReleaseWithDegradation(escrow);
  }

  /**
   * Refund escrowed coins back to the payer. Only the payer can refund.
   *
   * Graceful degradation: the escrow is first set to 'refund_pending',
   * then the coin return is attempted with retries. If the return
   * ultimately fails, the escrow stays in 'refund_pending' for
   * reconciliation rather than silently losing coins.
   */
  async refundEscrow(
    userId: string,
    escrowId: string,
  ): Promise<RefundEscrowResult> {
    const escrow = await this.findEscrowOrThrow(escrowId);

    if (escrow.payer_id !== userId) {
      throw new ForbiddenException('Only the payer can refund escrowed funds.');
    }

    if (escrow.status === 'refund_pending') {
      return this.finaliseRefundEscrow(escrow);
    }

    if (escrow.status !== 'held') {
      throw new ConflictException(
        `Escrow is not in 'held' status (current: ${escrow.status}).`,
      );
    }

    return this.performRefundWithDegradation(escrow);
  }

  /**
   * Reconcile an escrow that is stuck in a degraded state (release_pending
   * or refund_pending). Returns the escrow to a consistent terminal state
   * by retrying the failed coin operation.
   *
   * Both payer and payee can trigger reconciliation.
   */
  async reconcileEscrow(
    userId: string,
    escrowId: string,
  ): Promise<ReconcileEscrowResult> {
    const escrow = await this.findEscrowOrThrow(escrowId);

    if (escrow.payer_id !== userId && escrow.payee_id !== userId) {
      throw new ForbiddenException(
        'You are not a participant in this escrow transaction.',
      );
    }

    if (escrow.status === 'release_pending') {
      const result = await this.finaliseReleaseEscrow(escrow);
      return {
        id: result.id,
        status: result.status,
        amount_coins: result.amount_coins,
        reconciliation: 'completed',
      };
    }

    if (escrow.status === 'refund_pending') {
      const result = await this.finaliseRefundEscrow(escrow);
      return {
        id: result.id,
        status: result.status,
        amount_coins: result.amount_coins,
        reconciliation: 'completed',
      };
    }

    return {
      id: escrow.id,
      status: escrow.status,
      amount_coins: escrow.amount_coins,
      reconciliation: 'already_consistent',
    };
  }

  /**
   * Get a single escrow transaction by ID. The caller must be
   * either the payer or the payee.
   */
  async getEscrow(
    userId: string,
    escrowId: string,
  ): Promise<EscrowTransaction> {
    const escrow = await this.findEscrowOrThrow(escrowId);

    if (escrow.payer_id !== userId && escrow.payee_id !== userId) {
      throw new ForbiddenException(
        'You are not a participant in this escrow transaction.',
      );
    }

    return escrow;
  }

  /**
   * List escrow transactions for the calling user as either payer or payee.
   * Payload size control (#2396): hard-capped at MAX_LIST_LIMIT items per page.
   */
  async listEscrows(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ escrows: EscrowTransaction[]; total: number }> {
    const cappedLimit = Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
    const supabase = this.supabaseService.getClient();

    const { data, error, count } = await supabase
      .from('escrow_transactions')
      .select('*', { count: 'exact' })
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + cappedLimit - 1);

    if (error) {
      throw new BadRequestException('Failed to fetch escrow transactions.');
    }

    return {
      escrows: data ?? [],
      total: count ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findEscrowOrThrow(
    escrowId: string,
  ): Promise<EscrowTransaction> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('escrow_transactions')
=======
        reason: dto.reason,
        metadata: dto.metadata || {},
        held_at: now,
        retry_count: 0,
      } as never)
>>>>>>> origin/main
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
<<<<<<< HEAD
   * Phase 1 of release: atomically transition from 'held' to 'release_pending'.
   * Then attempt the coin transfer. On success: finalise to 'released'.
   * On failure: leave in 'release_pending' for reconciliation.
   */
  private async performReleaseWithDegradation(
    escrow: EscrowTransaction,
  ): Promise<ReleaseEscrowResult> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    // Atomic transition to pending state
    const { error: updateError } = await supabase
      .from('escrow_transactions')
      .update({
        status: 'release_pending' as EscrowStatus,
        released_at: now,
        updated_at: now,
      })
      .eq('id', escrow.id)
      .eq('status', 'held');

    if (updateError) {
      throw new BadRequestException(
        'Failed to transition escrow to release pending state.',
      );
    }

    escrow.status = 'release_pending';
    return this.finaliseReleaseEscrow(escrow);
  }

  /**
   * Finalise a release_pending escrow by executing (or retrying) the coin
   * transfer to the payee. On success, updates to 'released'. On failure,
   * leaves in 'release_pending' so reconciliation can continue later.
   */
  private async finaliseReleaseEscrow(
    escrow: EscrowTransaction,
  ): Promise<ReleaseEscrowResult> {
    const supabase = this.supabaseService.getClient();
    let payeeBalance: number;

    try {
      const { result } = await this.retryService.withRetry(
        () =>
          this.monetisationService.addCoins(
            escrow.payee_id,
            escrow.amount_coins,
          ),
        { maxRetries: COIN_OP_MAX_RETRIES, baseDelayMs: 500 },
      );
      payeeBalance = result;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to transfer coins for release_pending escrow ${escrow.id} after retries: ${(err as Error)?.message ?? 'unknown'}. Left in release_pending for reconciliation.`,
      );
      throw new BadRequestException(
        `Coin transfer failed for escrow ${escrow.id}. The escrow is in 'release_pending' state and can be reconciled later.`,
      );
    }

    // Mark as fully released
    const now = new Date().toISOString();
    await supabase
      .from('escrow_transactions')
      .update({
        status: 'released',
        updated_at: now,
      })
      .eq('id', escrow.id)
      .eq('status', 'release_pending');

    this.logger.log(
      `Escrow ${escrow.id} released: ${escrow.amount_coins} coins to ${escrow.payee_id}`,
    );

    return {
      id: escrow.id,
      status: 'released',
      amount_coins: escrow.amount_coins,
      payee_balance: payeeBalance,
    };
  }

  /**
   * Phase 1 of refund: atomically transition from 'held' to 'refund_pending'.
   * Then attempt the coin return. On success: finalise to 'refunded'.
   * On failure: leave in 'refund_pending' for reconciliation.
   */
  private async performRefundWithDegradation(
    escrow: EscrowTransaction,
  ): Promise<RefundEscrowResult> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    // Atomic transition to pending state
    const { error: updateError } = await supabase
      .from('escrow_transactions')
      .update({
        status: 'refund_pending' as EscrowStatus,
        refunded_at: now,
        updated_at: now,
      })
      .eq('id', escrow.id)
      .eq('status', 'held');

    if (updateError) {
      throw new BadRequestException(
        'Failed to transition escrow to refund pending state.',
      );
    }

    escrow.status = 'refund_pending';
    return this.finaliseRefundEscrow(escrow);
  }

  /**
   * Finalise a refund_pending escrow by executing (or retrying) the coin
   * return to the payer. On success, updates to 'refunded'. On failure,
   * leaves in 'refund_pending' so reconciliation can continue later.
   */
  private async finaliseRefundEscrow(
    escrow: EscrowTransaction,
  ): Promise<RefundEscrowResult> {
    const supabase = this.supabaseService.getClient();
    let payerBalance: number;

    try {
      const { result } = await this.retryService.withRetry(
        () =>
          this.monetisationService.addCoins(
            escrow.payer_id,
            escrow.amount_coins,
          ),
        { maxRetries: COIN_OP_MAX_RETRIES, baseDelayMs: 500 },
      );
      payerBalance = result;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to return coins for refund_pending escrow ${escrow.id} after retries: ${(err as Error)?.message ?? 'unknown'}. Left in refund_pending for reconciliation.`,
      );
      throw new BadRequestException(
        `Coin return failed for escrow ${escrow.id}. The escrow is in 'refund_pending' state and can be reconciled later.`,
      );
    }

    // Mark as fully refunded
    const now = new Date().toISOString();
    await supabase
      .from('escrow_transactions')
      .update({
        status: 'refunded',
        updated_at: now,
      })
      .eq('id', escrow.id)
      .eq('status', 'refund_pending');

    this.logger.log(
      `Escrow ${escrow.id} refunded: ${escrow.amount_coins} coins returned to ${escrow.payer_id}`,
    );

    return {
      id: escrow.id,
      status: 'refunded',
      amount_coins: escrow.amount_coins,
      payer_balance: payerBalance,
    };
  }

  /**
   * Periodically refund held escrows that have been dormant beyond a configurable
   * threshold, AND retry reconciliation for degraded (release_pending / refund_pending)
   * escrows to prevent stale escrows from accumulating indefinitely.
   * Audit (#2396): batch-limited to avoid large in-memory result sets.
=======
   * Degraded hold: When the database is unavailable, we log the intent
   * and queue for later processing via a Redis-based pending queue.
>>>>>>> origin/main
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
<<<<<<< HEAD
    let totalRefunded = 0;
    let totalReconciled = 0;

    // Phase 1: auto-refund expired held escrows
    while (true) {
      const { data: expired, error } = await supabase
        .from('escrow_transactions')
        .select('id, payer_id, amount_coins')
        .eq('status', 'held')
        .lt('created_at', threshold)
        .limit(CLEANUP_BATCH_SIZE);
=======

    const { data: txRow, error: txError } = await supabase
      .from('escrow_transactions' as never)
      .select('*')
      .eq('id', transactionId)
      .single();
>>>>>>> origin/main

    if (txError || !txRow) {
      throw new NotFoundException('Escrow transaction not found');
    }

<<<<<<< HEAD
      for (const row of expired) {
        const record = row;
=======
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
      .select('*')
      .single();

    if (updateError || !updated) {
      this.logger.error(
        `Failed to update escrow ${transactionId} status to released: ${updateError?.message ?? 'invalid data returned'}`,
      );
      throw new InternalServerErrorException('Failed to update escrow status');
    }

    this.logger.log(
      `Escrow released: ${transactionId} - ${tx.amount_coins} coins to ${tx.payee_id}`,
    );

    return updated;
  }

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
>>>>>>> origin/main
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

<<<<<<< HEAD
    // Phase 2: retry reconciliation for degraded escrows (release_pending / refund_pending)
    // that have been stuck longer than 1 hour
    const degradationThreshold = new Date(
      Date.now() - 60 * 60 * 1000,
    ).toISOString();

    while (true) {
      const { data: degraded, error } = await supabase
        .from('escrow_transactions')
        .select('id, payer_id, payee_id, amount_coins, status')
        .in('status', ['release_pending', 'refund_pending'])
        .lt('updated_at', degradationThreshold)
        .limit(CLEANUP_BATCH_SIZE);

      if (error || !degraded || degraded.length === 0) break;

      for (const row of degraded) {
        const record = row as {
          id: string;
          payer_id: string;
          payee_id: string;
          amount_coins: number;
          status: string;
        };
        try {
          if (record.status === 'release_pending') {
            await this.finaliseReleaseEscrow(
              record as unknown as EscrowTransaction,
            );
          } else {
            await this.finaliseRefundEscrow(
              record as unknown as EscrowTransaction,
            );
          }
          totalReconciled++;
        } catch (err: unknown) {
          this.logger.warn(
            `Cleanup: could not reconcile degraded escrow ${record.id}: ${(err as Error)?.message ?? 'unknown'}`,
          );
        }
      }
    }

    if (totalRefunded > 0 || totalReconciled > 0) {
      this.logger.log(
        `Escrow cleanup: auto-refunded ${totalRefunded}, reconciled ${totalReconciled} degraded escrows`,
=======
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
>>>>>>> origin/main
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
  }
}
