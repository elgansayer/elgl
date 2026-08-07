import {
  BadRequestException,
  ConflictException,
  Injectable,
<<<<<<< HEAD
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import {
  CreateEscrowDto,
  EscrowTransactionRow,
  EscrowDisputeRow,
} from './dto/escrow.dto';

/**
 * Escrow payment service.
 *
 * Flow:
 * 1. Payer creates an escrow transaction (coins are immediately deducted).
 * 2. Payee delivers the agreed service / milestone.
 * 3. Payer releases the escrow → coins are credited to the payee.
 * 4. Alternatively, the payer may request a refund before release.
 * 5. Either party may raise a dispute, which locks the transaction until
 *    an admin resolves it.
 */
@Injectable()
export class EscrowService {
  constructor(
    @InjectPinoLogger(EscrowService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  // ── Public read helpers ─────────────────────────────────────────────────

  async getEscrowTransactionsForUser(
    userId: string,
  ): Promise<EscrowTransactionRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch escrow transactions: ${error.message}`);
      throw error;
    }

    return (data as EscrowTransactionRow[]) ?? [];
  }

  async getEscrowTransactionById(
    transactionId: string,
  ): Promise<EscrowTransactionRow> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !data) {
      throw new NotFoundException(
        `Escrow transaction "${transactionId}" not found.`,
      );
    }

    return data as EscrowTransactionRow;
  }

  async getDisputesForEscrowTransaction(
    escrowTransactionId: string,
  ): Promise<EscrowDisputeRow[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_disputes')
      .select('*')
      .eq('escrow_transaction_id', escrowTransactionId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to fetch escrow disputes: ${error.message}`);
      throw error;
    }

    return (data as EscrowDisputeRow[]) ?? [];
  }

  // ── Escrow lifecycle ────────────────────────────────────────────────────

  /**
   * Creates a new escrow transaction. Coins are immediately deducted from the
   * payer and held until released, refunded, or disputed.
   */
  async createEscrow(
    payerId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowTransactionRow> {
    if (payerId === dto.payee_id) {
      throw new BadRequestException(
        'You cannot create an escrow transaction with yourself.',
      );
    }

    const supabase = this.supabaseService.getClient();

    // Verify payee exists
    const payee = await this.usersService.getProfile(dto.payee_id);
    if (!payee) {
      throw new NotFoundException('Payee user not found.');
    }

    // Verify payer has sufficient balance
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

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

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
>>>>>>> origin/main
    const { data: payerRow, error: payerError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

    if (payerError || !payerRow) {
<<<<<<< HEAD
      throw new NotFoundException('Payer user not found.');
    }

    const currentBalance: number = payerRow.coins_balance ?? 0;
    if (currentBalance < dto.amount_coins) {
      throw new BadRequestException(
        `Insufficient coin balance. You have ${currentBalance} coins but this escrow requires ${dto.amount_coins}.`,
      );
    }

    // Deduct coins from payer immediately
    const newBalance = currentBalance - dto.amount_coins;
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', payerId);

    if (updateError) {
      throw new Error('Failed to deduct coins from payer.');
    }

    // Create the escrow transaction
    const { data: escrow, error: insertError } = await supabase
      .from('escrow_transactions')
=======
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
>>>>>>> origin/main
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
<<<<<<< HEAD
        milestone_description: dto.milestone_description,
        status: 'pending_held',
      })
      .select()
      .single();

    if (insertError || !escrow) {
      // Rollback the coin deduction
      await supabase
        .from('users')
        .update({ coins_balance: currentBalance })
        .eq('id', payerId);
      throw new Error('Failed to create escrow transaction. Coins refunded.');
    }

    this.logger.info(
      `Escrow created: ${escrow.id} – ${dto.amount_coins} coins from ${payerId} to ${dto.payee_id}`,
    );

    return escrow as EscrowTransactionRow;
  }

  /**
   * Payer releases the escrowed funds to the payee.
   */
  async releaseEscrow(
    escrowId: string,
    userId: string,
  ): Promise<EscrowTransactionRow> {
    const supabase = this.supabaseService.getClient();
    const escrow = await this.getEscrowTransactionById(escrowId);

    if (escrow.payer_id !== userId) {
      throw new BadRequestException(
        'Only the payer can release escrowed funds.',
      );
    }

    if (escrow.status !== 'pending_held') {
      throw new ConflictException(
        `Escrow transaction is already ${escrow.status}.`,
      );
    }

=======
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

>>>>>>> origin/main
    // Credit coins to payee
    const { data: payeeRow, error: payeeError } = await supabase
      .from('users')
      .select('coins_balance')
<<<<<<< HEAD
      .eq('id', escrow.payee_id)
      .single();

    if (payeeError || !payeeRow) {
      throw new Error('Payee account not found.');
    }

    const payeeNewBalance =
      (payeeRow.coins_balance ?? 0) + escrow.amount_coins;

    const { error: creditError } = await supabase
      .from('users')
      .update({ coins_balance: payeeNewBalance })
      .eq('id', escrow.payee_id);

    if (creditError) {
      throw new Error('Failed to credit coins to payee.');
    }

    // Mark escrow as released
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('escrow_transactions')
      .update({ status: 'released', released_at: now, updated_at: now })
      .eq('id', escrowId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error('Failed to update escrow status.');
    }

    this.logger.info(
      `Escrow ${escrowId} released: ${escrow.amount_coins} coins credited to ${escrow.payee_id}`,
    );

    return updated as EscrowTransactionRow;
  }

  /**
   * Payer requests a refund of escrowed funds before release.
   */
  async refundEscrow(
    escrowId: string,
    userId: string,
  ): Promise<EscrowTransactionRow> {
    const supabase = this.supabaseService.getClient();
    const escrow = await this.getEscrowTransactionById(escrowId);

    if (escrow.payer_id !== userId) {
      throw new BadRequestException(
        'Only the payer can request a refund.',
      );
    }

    if (escrow.status !== 'pending_held') {
      throw new ConflictException(
        `Escrow transaction is already ${escrow.status}.`,
      );
    }

    // Credit coins back to payer
    const { data: payerRow, error: payerError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (payerError || !payerRow) {
      throw new Error('Payer account not found.');
    }

    const payerNewBalance =
      (payerRow.coins_balance ?? 0) + escrow.amount_coins;

    const { error: creditError } = await supabase
      .from('users')
      .update({ coins_balance: payerNewBalance })
      .eq('id', userId);

    if (creditError) {
      throw new Error('Failed to refund coins to payer.');
    }

    // Mark escrow as refunded
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('escrow_transactions')
      .update({ status: 'refunded', released_at: now, updated_at: now })
      .eq('id', escrowId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error('Failed to update escrow status.');
    }

    this.logger.info(
      `Escrow ${escrowId} refunded: ${escrow.amount_coins} coins returned to ${userId}`,
    );

    return updated as EscrowTransactionRow;
  }

  // ── Dispute management ──────────────────────────────────────────────────

  /**
   * Either the payer or payee can raise a dispute on a pending-held escrow.
   * The escrow moves to 'disputed' status and an admin must resolve it.
   */
  async raiseDispute(
    escrowTransactionId: string,
    userId: string,
    reason: string,
  ): Promise<EscrowDisputeRow> {
    const supabase = this.supabaseService.getClient();
    const escrow = await this.getEscrowTransactionById(escrowTransactionId);

    if (escrow.payer_id !== userId && escrow.payee_id !== userId) {
      throw new BadRequestException(
        'Only the payer or payee can raise a dispute.',
      );
    }

    if (escrow.status === 'disputed') {
      throw new ConflictException(
        'A dispute has already been raised for this escrow transaction.',
      );
    }

    if (escrow.status !== 'pending_held') {
      throw new BadRequestException(
        `Cannot dispute an escrow that is already ${escrow.status}.`,
      );
    }

    // Move escrow to disputed status
    const now = new Date().toISOString();
    const { error: escrowUpdateError } = await supabase
      .from('escrow_transactions')
      .update({ status: 'disputed', updated_at: now })
      .eq('id', escrowTransactionId);

    if (escrowUpdateError) {
      throw new Error('Failed to update escrow status to disputed.');
    }

    // Create the dispute record
    const { data: dispute, error: disputeError } = await supabase
      .from('escrow_disputes')
      .insert({
        escrow_transaction_id: escrowTransactionId,
        raised_by_id: userId,
        reason,
        resolution: 'pending',
      })
      .select()
      .single();

    if (disputeError || !dispute) {
      // Rollback escrow status
      await supabase
        .from('escrow_transactions')
        .update({ status: 'pending_held', updated_at: escrow.updated_at })
        .eq('id', escrowTransactionId);
      throw new Error('Failed to create dispute record. Escrow status rolled back.');
    }

    this.logger.info(
      `Dispute raised for escrow ${escrowTransactionId} by user ${userId}.`,
    );

    return dispute as EscrowDisputeRow;
  }

  /**
   * Admin resolves a dispute, determining how the escrowed funds are
   * distributed.
   */
  async resolveDispute(
    disputeId: string,
    resolution: 'released_to_payee' | 'refunded_to_payer' | 'split',
    resolvedById: string,
    resolutionNotes?: string,
  ): Promise<EscrowDisputeRow> {
    const supabase = this.supabaseService.getClient();

    // Fetch the dispute
    const { data: dispute, error: disputeError } = await supabase
      .from('escrow_disputes')
      .select('*')
      .eq('id', disputeId)
      .single();

    if (disputeError || !dispute) {
      throw new NotFoundException(`Dispute "${disputeId}" not found.`);
    }

    if ((dispute as EscrowDisputeRow).resolution !== 'pending') {
      throw new ConflictException('This dispute has already been resolved.');
    }

    // Fetch the associated escrow transaction
    const escrow = await this.getEscrowTransactionById(
      (dispute as EscrowDisputeRow).escrow_transaction_id,
    );

    if (escrow.status !== 'disputed') {
      throw new ConflictException(
        `Escrow transaction is in unexpected status: ${escrow.status}.`,
      );
    }

    const now = new Date().toISOString();

    // Distribute coins based on resolution
    if (resolution === 'released_to_payee') {
      const { data: payeeRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrow.payee_id)
        .single();

      if (!payeeRow) throw new Error('Payee not found.');

      await supabase
        .from('users')
        .update({
          coins_balance:
            (payeeRow.coins_balance ?? 0) + escrow.amount_coins,
        })
        .eq('id', escrow.payee_id);

      await supabase
        .from('escrow_transactions')
        .update({ status: 'released', released_at: now, updated_at: now })
        .eq('id', escrow.id);
    } else if (resolution === 'refunded_to_payer') {
      const { data: payerRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrow.payer_id)
        .single();

      if (!payerRow) throw new Error('Payer not found.');

      await supabase
        .from('users')
        .update({
          coins_balance:
            (payerRow.coins_balance ?? 0) + escrow.amount_coins,
        })
        .eq('id', escrow.payer_id);

      await supabase
        .from('escrow_transactions')
        .update({ status: 'refunded', released_at: now, updated_at: now })
        .eq('id', escrow.id);
    } else if (resolution === 'split') {
      const half = Math.floor(escrow.amount_coins / 2);

      const { data: payerRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrow.payer_id)
        .single();

      const { data: payeeRow } = await supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrow.payee_id)
        .single();

      if (!payerRow || !payeeRow) throw new Error('User accounts not found.');

      await supabase
        .from('users')
        .update({
          coins_balance:
            (payerRow.coins_balance ?? 0) + half,
        })
        .eq('id', escrow.payer_id);

      await supabase
        .from('users')
        .update({
          coins_balance:
            (payeeRow.coins_balance ?? 0) + (escrow.amount_coins - half),
        })
        .eq('id', escrow.payee_id);

      await supabase
        .from('escrow_transactions')
        .update({ status: 'refunded', released_at: now, updated_at: now })
        .eq('id', escrow.id);
    }

    // Update dispute resolution
    const { data: resolved, error: resolveError } = await supabase
      .from('escrow_disputes')
      .update({
        resolution,
        resolution_notes: resolutionNotes ?? '',
        resolved_by_id: resolvedById,
        resolved_at: now,
      })
      .eq('id', disputeId)
      .select()
      .single();

    if (resolveError || !resolved) {
      throw new Error('Failed to update dispute resolution.');
    }

    this.logger.info(
      `Dispute ${disputeId} resolved as "${resolution}" by admin ${resolvedById}.`,
    );

    return resolved as EscrowDisputeRow;
  }
}
=======
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
      this.logger.warn(
        `Failed to list escrow transactions for ${userId}: ${error?.message}`,
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
  }
}
>>>>>>> origin/main
