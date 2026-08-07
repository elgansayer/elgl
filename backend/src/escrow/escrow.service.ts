import {
<<<<<<< HEAD
<<<<<<< HEAD
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { GdprDataScrubbingService } from './gdpr-data-scrubbing.service';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ReleaseMilestoneDto } from './dto/release-milestone.dto';
import { DisputeEscrowDto } from './dto/dispute-escrow.dto';
import {
  EscrowTransaction,
  EscrowMilestone,
  EscrowDispute,
  DataScrubbingResult,
} from './interfaces/escrow.interface';

interface MilestoneInput {
  title: string;
  amount_cents: number;
}
=======
  Injectable,
  Logger,
=======
>>>>>>> origin/main
  BadRequestException,
  ConflictException,
  Injectable,
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
<<<<<<< HEAD
  CreateEscrowResult,
  ReleaseEscrowResult,
  RefundEscrowResult,
} from './interfaces/escrow.interface';
import { CreateEscrowDto } from './dto/escrow.dto';
>>>>>>> origin/main
=======
  EscrowHoldResult,
  EscrowReleaseResult,
} from './interfaces/escrow-transaction.interface';
import {
  CreateEscrowHoldDto,
  EscrowTransactionResponse,
} from './dto/escrow.dto';

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
<<<<<<< HEAD
    private readonly configService: ConfigService,
    private readonly gdprScrubbing: GdprDataScrubbingService,
  ) {}

  async createEscrow(
    userId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowTransaction> {
    if (dto.recipient_id === userId) {
      throw new BadRequestException(
        'Sender and recipient must be different users',
      );
    }

    const milestoneCount = dto.milestone_count ?? 1;
    const perMilestoneAmount = Math.floor(dto.amount_cents / milestoneCount);

    const retentionDate = this.gdprScrubbing.calculateRetentionDate();
    const escapedSubject = this.gdprScrubbing.scrubFreeText(
      dto.transaction_subject,
    );
    const escapedDescription = dto.description
      ? this.gdprScrubbing.scrubFreeText(dto.description)
      : null;

    const supabase = this.supabaseService.getClient();

    const { data: transaction, error } = await supabase
      .from('escrow_transactions')
      .insert({
        sender_id: userId,
        recipient_id: dto.recipient_id,
        transaction_subject: escapedSubject,
        description: escapedDescription,
        amount_cents: dto.amount_cents,
        currency: dto.currency,
        status: 'pending',
        total_milestones: milestoneCount,
        released_milestones: 0,
        gdpr_retention_date: retentionDate.toISOString(),
        is_data_scrubbed: false,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(
        `Failed to create escrow transaction: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to create escrow transaction',
      );
    }

    const milestones = this.buildMilestones(
      transaction.id,
      perMilestoneAmount,
      milestoneCount,
    );
    const { error: milestoneError } = await supabase
      .from('escrow_milestones')
      .insert(milestones);

    if (milestoneError) {
      this.logger.error(
        `Failed to create milestones for escrow ${transaction.id}: ${milestoneError.message}`,
      );
      await supabase
        .from('escrow_transactions')
        .delete()
        .eq('id', transaction.id);
      throw new InternalServerErrorException('Failed to create milestones');
    }

    this.logger.log(
      `Escrow transaction ${transaction.id} created by ${userId} for ${dto.recipient_id}`,
    );

    return transaction;
  }

  async getEscrow(
    userId: string,
    escrowId: string,
  ): Promise<EscrowTransaction> {
    const supabase = this.supabaseService.getClient();
=======
    private readonly monetisationService: MonetisationService,
=======
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly configService: ConfigService,
>>>>>>> origin/main
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
    return {
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
    };
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

    return {
      success: true,
      transaction_id:
        typeof result === 'object' && result !== null && 'id' in result
          ? String(result.id)
          : '',
      degraded: degradedMarker.degraded,
      fallback_reason: degradedMarker.reason,
    };
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

    return {
      success: true,
      transaction_id: result.id,
      degraded: degradedMarker.degraded,
      fallback_reason: degradedMarker.reason,
    };
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
        await supabase
          .from('users')
          .update({ coins_balance: payerBalance + tx.amount_coins })
          .eq('id', tx.payer_id);
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

<<<<<<< HEAD
    return {
      escrows: (data ?? []) as EscrowTransaction[],
      total: count ?? 0,
    };
  }

  private async findEscrowOrThrow(
    escrowId: string,
  ): Promise<EscrowTransaction> {
    const supabase = this.supabaseService.getClient();

>>>>>>> origin/main
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
<<<<<<< HEAD
      throw new NotFoundException('Escrow transaction not found');
    }

    const transaction = data as EscrowTransaction;
    if (
      transaction.sender_id !== userId &&
      transaction.recipient_id !== userId
    ) {
      throw new ForbiddenException(
        'You are not a party to this escrow transaction',
      );
    }

    if (transaction.is_data_scrubbed) {
      const { scrubbed } = this.gdprScrubbing.scrubTransactionData(
        transaction as unknown as Record<string, unknown>,
      );
      return scrubbed as unknown as EscrowTransaction;
    }

    return transaction;
  }

  async getUserEscrows(userId: string): Promise<EscrowTransaction[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_transactions')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve escrow transactions',
      );
    }

    const transactions = (data ?? []) as EscrowTransaction[];
    return transactions.map((tx) => {
      if (tx.is_data_scrubbed) {
        const { scrubbed } = this.gdprScrubbing.scrubTransactionData(
          tx as unknown as Record<string, unknown>,
        );
        return scrubbed as unknown as EscrowTransaction;
      }
      return tx;
    });
  }

  async getMilestones(
    userId: string,
    escrowId: string,
  ): Promise<EscrowMilestone[]> {
    await this.getEscrow(userId, escrowId);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_milestones')
      .select('*')
      .eq('escrow_id', escrowId)
      .order('milestone_index', { ascending: true });

    if (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve escrow milestones',
      );
    }

    return data ?? [];
  }

  async releaseMilestone(
    userId: string,
    dto: ReleaseMilestoneDto,
  ): Promise<EscrowMilestone> {
    const transaction = await this.getEscrow(userId, dto.escrow_id);

    if (transaction.sender_id !== userId) {
      throw new ForbiddenException(
        'Only the sender can release milestone payments',
      );
    }

    if (transaction.status === 'disputed') {
      throw new ConflictException(
        'Cannot release milestones while transaction is disputed',
      );
    }

    if (transaction.is_data_scrubbed) {
      throw new BadRequestException(
        'This transaction has been scrubbed and cannot be modified',
      );
    }

    const supabase = this.supabaseService.getClient();
    const { data: milestone, error } = await supabase
      .from('escrow_milestones')
      .select('*')
      .eq('id', dto.milestone_id)
      .eq('escrow_id', dto.escrow_id)
      .single();

    if (error || !milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const m = milestone as EscrowMilestone;
    if (m.status !== 'pending') {
      throw new ConflictException(`Milestone already in "${m.status}" status`);
    }

    const escapedNote = dto.release_note
      ? this.gdprScrubbing.scrubFreeText(dto.release_note)
      : null;

    const { error: updateError } = await supabase
      .from('escrow_milestones')
      .update({
        status: 'released',
        release_note: escapedNote,
        released_at: new Date().toISOString(),
      })
      .eq('id', m.id);

    if (updateError) {
      throw new InternalServerErrorException('Failed to release milestone');
    }

    const newReleasedCount = transaction.released_milestones + 1;
    const newStatus =
      newReleasedCount >= transaction.total_milestones
        ? 'completed'
        : 'partially_released';

    const updates: Record<string, unknown> = {
      released_milestones: newReleasedCount,
      status: newStatus,
    };
    if (newStatus === 'completed') {
      updates['completed_at'] = new Date().toISOString();
    }

    const { error: txUpdateError } = await supabase
      .from('escrow_transactions')
      .update(updates)
      .eq('id', dto.escrow_id);

    if (txUpdateError) {
      this.logger.error(
        `Failed to update transaction status after milestone release: ${txUpdateError.message}`,
      );
    }

    this.logger.log(
      `Milestone ${m.id} released for escrow ${dto.escrow_id} by ${userId}`,
    );

    return { ...m, status: 'released', release_note: escapedNote };
  }

  async disputeEscrow(
    userId: string,
    dto: DisputeEscrowDto,
  ): Promise<EscrowDispute> {
    const transaction = await this.getEscrow(userId, dto.escrow_id);

    if (
      transaction.sender_id !== userId &&
      transaction.recipient_id !== userId
    ) {
      throw new ForbiddenException(
        'Only parties to the transaction can raise a dispute',
      );
    }

    if (transaction.is_data_scrubbed) {
      throw new BadRequestException(
        'This transaction has been scrubbed and cannot be disputed',
      );
    }

    const supabase = this.supabaseService.getClient();

    const { data: existing } = await supabase
      .from('escrow_disputes')
      .select('id')
      .eq('escrow_id', dto.escrow_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existing) {
      throw new ConflictException(
        'An open dispute already exists for this transaction',
      );
    }

    const escapedReason = this.gdprScrubbing.scrubFreeText(dto.reason);
    const escapedEvidence = dto.evidence_description
      ? this.gdprScrubbing.scrubFreeText(dto.evidence_description)
      : null;

    const { data: dispute, error } = await supabase
      .from('escrow_disputes')
      .insert({
        escrow_id: dto.escrow_id,
        raised_by: userId,
        reason: escapedReason,
        evidence_description: escapedEvidence,
        status: 'open',
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(
        `Failed to create dispute for escrow ${dto.escrow_id}: ${error.message}`,
      );
      throw new InternalServerErrorException('Failed to create dispute');
    }

    await supabase
      .from('escrow_transactions')
      .update({ status: 'disputed' })
      .eq('id', dto.escrow_id);

    this.logger.log(`Dispute raised for escrow ${dto.escrow_id} by ${userId}`);

    return dispute;
  }

  async scrubExpiredData(): Promise<DataScrubbingResult[]> {
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();
    const results: DataScrubbingResult[] = [];

    const { data: expiredTransactions } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('is_data_scrubbed', false)
      .lte('gdpr_retention_date', now)
      .in('status', ['completed', 'refunded', 'cancelled']);

    const transactions = (expiredTransactions ?? []) as EscrowTransaction[];

    for (const tx of transactions) {
      const { scrubbed, result } = this.gdprScrubbing.scrubTransactionData(
        tx as unknown as Record<string, unknown>,
      );

      const { error } = await supabase
        .from('escrow_transactions')
        .update({
          transaction_subject: scrubbed.transaction_subject,
          description: scrubbed.description,
          is_data_scrubbed: true,
          gdpr_scrubbed_at: scrubbed.gdpr_scrubbed_at,
        })
        .eq('id', tx.id);

      if (error) {
        this.logger.error(
          `Failed to scrub transaction ${tx.id}: ${error.message}`,
        );
        continue;
      }

      await supabase
        .from('escrow_milestones')
        .update({ release_note: '[REDACTED]' })
        .eq('escrow_id', tx.id);

      await supabase
        .from('escrow_disputes')
        .update({
          reason: '[REDACTED]',
          evidence_description: '[REDACTED]',
          resolution_note: '[REDACTED]',
        })
        .eq('escrow_id', tx.id);

      this.gdprScrubbing.logScrubbingEvent(tx.id, result);
      results.push(result);
    }

    this.logger.log(`Scrubbed ${results.length} expired escrow transactions`);
    return results;
  }

  async requestDataDeletion(userId: string): Promise<{
    transactions_scrubbed: number;
    disputes_anonymised: number;
  }> {
    const supabase = this.supabaseService.getClient();

    const { data: transactions } = await supabase
      .from('escrow_transactions')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('is_data_scrubbed', false);

    const txs = (transactions ?? []) as EscrowTransaction[];
    let transactionsScrubbed = 0;
    let disputesAnonymised = 0;

    for (const tx of txs) {
      if (
        tx.status === 'pending' ||
        tx.status === 'funded' ||
        tx.status === 'disputed'
      ) {
        await supabase
          .from('escrow_transactions')
          .update({ status: 'cancelled', is_data_scrubbed: true })
          .eq('id', tx.id);
      } else {
        const { scrubbed } = this.gdprScrubbing.scrubTransactionData(
          tx as unknown as Record<string, unknown>,
        );
        await supabase
          .from('escrow_transactions')
          .update({
            transaction_subject: scrubbed.transaction_subject,
            description: scrubbed.description,
            is_data_scrubbed: true,
          })
          .eq('id', tx.id);
      }

      await supabase
        .from('escrow_milestones')
        .update({ release_note: '[REDACTED]' })
        .eq('escrow_id', tx.id);

      const { data: disputes } = await supabase
        .from('escrow_disputes')
        .select('id')
        .eq('escrow_id', tx.id);

      if (disputes && disputes.length > 0) {
        await supabase
          .from('escrow_disputes')
          .update({
            reason: '[REDACTED - User requested deletion]',
            evidence_description: '[REDACTED - User requested deletion]',
            resolution_note: '[REDACTED - User requested deletion]',
          })
          .eq('escrow_id', tx.id);
        disputesAnonymised += disputes.length;
      }

      transactionsScrubbed++;
    }

    this.logger.log(
      `User ${userId} deletion: scrubbed ${transactionsScrubbed} transactions, ` +
        `anonymised ${disputesAnonymised} disputes`,
    );

    return {
      transactions_scrubbed: transactionsScrubbed,
      disputes_anonymised: disputesAnonymised,
    };
  }

  async getPiiReport(
    escrowId: string,
  ): Promise<{ hasPii: boolean; details: Record<string, unknown> }> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('escrow_transactions')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (!data) {
      throw new NotFoundException('Escrow transaction not found');
    }

    const tx = data as EscrowTransaction;
    const details: Record<string, unknown> = {};

    const subjectCheck = this.gdprScrubbing.detectPii(tx.transaction_subject);
    if (subjectCheck.hasPii) {
      details['transaction_subject'] = subjectCheck;
    }

    if (tx.description) {
      const descCheck = this.gdprScrubbing.detectPii(tx.description);
      if (descCheck.hasPii) {
        details['description'] = descCheck;
      }
    }

    const { data: disputes } = await supabase
      .from('escrow_disputes')
      .select('*')
      .eq('escrow_id', escrowId);

    if (disputes && disputes.length > 0) {
      details['dispute_pii_found'] = false;
      for (const dispute of disputes) {
        const d = dispute as EscrowDispute;
        const reasonCheck = this.gdprScrubbing.detectPii(d.reason);
        if (reasonCheck.hasPii) {
          details['dispute_pii_found'] = true;
        }
      }
    }

    return {
      hasPii: Object.keys(details).length > 0,
      details,
    };
  }

  private buildMilestones(
    escrowId: string,
    perMilestoneAmount: number,
    count: number,
  ): MilestoneInput[] {
    const milestones: MilestoneInput[] = [];
    for (let i = 0; i < count; i++) {
      milestones.push({
        title: `Milestone ${i + 1}`,
        amount_cents: perMilestoneAmount,
      });
    }
    return milestones;
  }
}
=======
      throw new NotFoundException(
        `Escrow transaction ${escrowId} not found.`,
=======
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
>>>>>>> origin/main
      );
    }

    return { processed, failed };
  }
<<<<<<< HEAD
}
>>>>>>> origin/main
=======

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
