import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { CrashReportService } from './crash-report.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { MetricsService } from '../metrics/metrics.service';
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

/** Redis cache key prefixes for escrow read-through caching. */
const ESCROW_DETAIL_PREFIX = 'escrow:detail:';
const ESCROW_USER_LIST_PREFIX = 'escrow:user_list:';

/** TTL (seconds) for escrow detail cache entries. */
const ESCROW_DETAIL_TTL = 120;
/** TTL (seconds) for escrow user list cache entries. */
const ESCROW_USER_LIST_TTL = 60;

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly crashReportService: CrashReportService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
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

    const transactionId =
      typeof result === 'object' && result !== null && 'id' in result
        ? String(result.id)
        : '';

    if (!degradedMarker.degraded && transactionId) {
      this.invalidateEscrowCaches(transactionId, payerId, dto.payee_id);
    }

    return sanitiseEscrowData({
      success: true,
      transaction_id: transactionId,
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
      // Refund the deducted coins on failure -- critical rollback boundary
      try {
        await supabase
          .from('users')
          .update({ coins_balance: payerBalance })
          .eq('id', payerId);
      } catch (rollbackError) {
        await this.crashReportService.reportCrash({
          operation: 'holdCoins_rollback',
          user_id: payerId,
          error_type: 'RollbackFailure',
          error_message: `Failed to rollback coin deduction after escrow creation failure: ${String(rollbackError)}`,
          context: {
            payer_id: payerId,
            payee_id: dto.payee_id,
            amount: dto.amount_coins,
            original_balance: payerBalance,
          },
        });
        throw new InternalServerErrorException(
          'Critical error: coin deduction could not be rolled back. Please contact support.',
        );
      }
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

    // Record metric for Datadog alerting (#2381)
    this.metricsService.recordEscrowCreated(dto.amount_coins);

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
    const id = `degraded_escrow_${Date.now()}_${randomUUID()}`;
    const degradedRecord = {
      id,
      payer_id: payerId,
      payee_id: dto.payee_id,
      amount_coins: dto.amount_coins,
      status: 'pending' as EscrowStatus,
      reason: dto.reason ?? '',
      metadata: dto.metadata || {},
      degraded: true,
      created_at: new Date().toISOString(),
    };

    try {
      await redis.lpush(
        'escrow_degraded_queue',
        JSON.stringify(degradedRecord),
      );
      this.metricsService.recordEscrowDegradedOperation();
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
      reason: dto.reason ?? '',
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

    if (!degradedMarker.degraded && result.payer_id && result.payee_id) {
      this.invalidateEscrowCaches(
        transactionId,
        result.payer_id,
        result.payee_id,
      );
    }

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

    // Record metric for Datadog alerting (#2381)
    this.metricsService.recordEscrowReleased(tx.amount_coins);

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

        // Record metric for Datadog alerting (#2381)
        this.metricsService.recordEscrowRefunded(
          tx.amount_coins,
          reason || 'manual',
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
          status: 'held',
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

    const tx = result;

    if (!degradedMarker.degraded && tx.payer_id && tx.payee_id) {
      this.invalidateEscrowCaches(transactionId, tx.payer_id, tx.payee_id);
    }

    return this.toResponse(tx, degradedMarker.degraded, degradedMarker.reason);
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

    // Record metric for Datadog alerting (#2381)
    this.metricsService.recordEscrowCancelled(tx.amount_coins);

    this.invalidateEscrowCaches(transactionId, tx.payer_id, tx.payee_id);

    return this.toResponse(updated);
  }

  /**
   * File a dispute against an escrow transaction.
   * Either party can dispute a held escrow. Updates status to 'disputed'
   * and stores the dispute reason with optional evidence.
   */
  async disputeEscrow(
    transactionId: string,
    userId: string,
    reason: string,
    evidence?: string,
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

    if (tx.payer_id !== userId && tx.payee_id !== userId) {
      throw new BadRequestException('Not authorised to dispute this escrow');
    }

    if (tx.status !== 'held') {
      throw new ConflictException(
        `Cannot dispute escrow in '${tx.status}' status. Only held escrows can be disputed.`,
      );
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('escrow_transactions' as never)
      .update({
        status: 'disputed' as EscrowStatus,
        reason: `${tx.reason ?? ''}\n[DISPUTE by ${userId}: ${reason}]`.trim(),
        metadata: {
          ...(tx.metadata ?? {}),
          dispute_initiator: userId,
          dispute_filed_at: now,
          dispute_evidence: evidence ?? null,
        },
      } as never)
      .eq('id', transactionId)
      .select('*')
      .single();

    if (updateError || !updated) {
      this.logger.error(
        `Failed to update escrow ${transactionId} status to disputed: ${updateError?.message ?? 'invalid data returned'}`,
      );
      throw new InternalServerErrorException('Failed to file dispute');
    }

    this.logger.log(`Escrow disputed: ${transactionId} by user ${userId}`);

    return this.toResponse(updated);
  }

  /**
   * Retrieves an escrow transaction by ID.
   *
   * Read-through Redis caching: escrow details are cached for a short
   * TTL to reduce database pressure during repeated reads (e.g., polling
   * by mobile clients awaiting payment confirmation).
   */
  async getTransaction(
    transactionId: string,
    userId: string,
  ): Promise<EscrowTransactionResponse> {
    const redis = this.supabaseService.getRedisClient();
    const cacheKey = `${ESCROW_DETAIL_PREFIX}${transactionId}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as EscrowTransaction;
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          'payer_id' in parsed &&
          'payee_id' in parsed
        ) {
          if (parsed.payer_id !== userId && parsed.payee_id !== userId) {
            throw new BadRequestException('Not authorised to view this escrow');
          }
          return this.toResponse(parsed);
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(
          `Invalid escrow detail cache entry for ${transactionId}, falling back to DB`,
        );
      }
    }

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

    void redis.set(cacheKey, JSON.stringify(tx), 'EX', ESCROW_DETAIL_TTL);

    return this.toResponse(tx);
  }

  /**
   * Lists escrow transactions for a user.
   *
   * Read-through Redis caching: the user's escrow list is cached with a short
   * TTL so repeated polling reads (common in payment flows) avoid DB round-trips.
   */
  async listTransactions(
    userId: string,
    status?: EscrowStatus,
    limit = 20,
    offset = 0,
  ): Promise<EscrowTransactionResponse[]> {
    const redis = this.supabaseService.getRedisClient();
    const statusSuffix = status ? `:s${status}` : '';
    const cacheKey = `${ESCROW_USER_LIST_PREFIX}${userId}:l${limit}:o${offset}${statusSuffix}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed as EscrowTransactionResponse[];
        }
      } catch {
        this.logger.warn(
          `Invalid escrow list cache entry for user ${userId}, falling back to DB`,
        );
      }
    }

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

    const result = (data as EscrowTransaction[]).map((tx) =>
      this.toResponse(tx),
    );

    void redis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      ESCROW_USER_LIST_TTL,
    );

    return result;
  }

  /**
   * Invalidate Redis caches related to an escrow transaction and its
   * participants. Called after every mutation (hold, release, refund, cancel)
   * to ensure reads stay consistent.
   *
   * Strategy:
   *  - Delete the escrow detail cache key.
   *  - Delete user list caches for both the payer and the payee.
   *    Because list caches are keyed by (userId, limit, offset[, status]), we
   *    use a SCAN + DEL pattern to cover all pagination/status-filter variants.
   */
  private invalidateEscrowCaches(
    transactionId: string,
    payerId: string,
    payeeId: string,
  ): void {
    const redis = this.supabaseService.getRedisClient();

    void (async () => {
      try {
        // Delete the specific detail key
        await redis.del(`${ESCROW_DETAIL_PREFIX}${transactionId}`);

        // Scan and delete user list keys for payer and payee
        for (const userId of [payerId, payeeId]) {
          let cursor = '0';
          do {
            const [nextCursor, scannedKeys] = await redis.scan(
              cursor,
              'MATCH',
              `${ESCROW_USER_LIST_PREFIX}${userId}:*`,
              'COUNT',
              100,
            );
            cursor = nextCursor;
            if (scannedKeys.length > 0) {
              await redis.del(...scannedKeys);
            }
          } while (cursor !== '0');
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to invalidate escrow caches for ${transactionId}: ${(err as Error)?.message ?? 'unknown'}`,
        );
      }
    })();
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
   * Auto-refunds stale escrow transactions that have been held for more than
   * 30 days without being released, refunded, or cancelled. This ensures coins
   * are returned to users rather than being locked indefinitely.
   *
   * Records metrics for Datadog alerting (#2381).
   */
  async processStaleEscrows(): Promise<{
    autoRefunded: number;
    failed: number;
  }> {
    const supabase = this.supabaseService.getClient();
    const staleThreshold = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    let autoRefunded = 0;
    let failed = 0;

    try {
      const { data: staleRows } = await supabase
        .from('escrow_transactions' as never)
        .select('id, payer_id, amount_coins')
        .eq('status', 'held')
        .lt('created_at', staleThreshold)
        .limit(100);

      if (!staleRows || staleRows.length === 0) {
        return { autoRefunded: 0, failed: 0 };
      }

      for (const row of staleRows as {
        id: string;
        payer_id: string;
        amount_coins: number;
      }[]) {
        try {
          // Refund coins to payer
          const { data: payerRow } = await supabase
            .from('users')
            .select('coins_balance')
            .eq('id', row.payer_id)
            .single();

          if (payerRow) {
            const payerBalance = (payerRow as { coins_balance: number })
              .coins_balance;
            await supabase
              .from('users')
              .update({ coins_balance: payerBalance + row.amount_coins })
              .eq('id', row.payer_id);
          }

          const now = new Date().toISOString();
          await supabase
            .from('escrow_transactions' as never)
            .update({
              status: 'refunded' as EscrowStatus,
              refunded_at: now,
              metadata: { auto_refund: true, refunded_at: now },
            } as never)
            .eq('id', row.id);

          this.metricsService.recordEscrowAutoRefunded(row.amount_coins);
          this.metricsService.recordEscrowRefunded(
            row.amount_coins,
            'auto_expiry',
          );

          this.invalidateEscrowCaches(row.id, row.payer_id, '');

          autoRefunded++;
          this.logger.log(
            `Auto-refunded stale escrow ${row.id}: ${row.amount_coins} coins to ${row.payer_id}`,
          );
        } catch (error: unknown) {
          failed++;
          this.logger.error(
            `Failed to auto-refund stale escrow ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to fetch stale escrows: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return { autoRefunded, failed };
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
