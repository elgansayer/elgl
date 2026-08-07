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
import { CircuitBreakerService } from './circuit-breaker.service';
import {
<<<<<<< HEAD
  CreateEscrowDto,
  DisputeEscrowDto,
  EscrowSummaryRow,
  ListEscrowDto,
  PaginatedEscrowResponse,
  RefundEscrowDto,
  ReleaseEscrowDto,
  ResolveDisputeDto,
} from './dto/escrow.dto';
import {
  EscrowRow,
  EscrowCreateResult,
=======
  EscrowTransaction,
  EscrowStatus,
  EscrowHoldResult,
>>>>>>> origin/main
  EscrowReleaseResult,
} from './interfaces/escrow-transaction.interface';
import {
  CreateEscrowHoldDto,
  EscrowTransactionResponse,
} from './dto/escrow.dto';
import { sanitiseEscrowData } from './sanitise-escrow.helper';

<<<<<<< HEAD
const DEFAULT_PAGE_SIZE = 20;
const VALID_ESCROW_STATUSES = [
  'pending',
  'released',
  'refunded',
  'disputed',
  'cancelled',
] as const;

function isEscrowRow(value: unknown): value is EscrowRow {
  if (typeof value !== 'object' || value === null) return false;
  if (
    !('id' in value) ||
    !('sender_id' in value) ||
    !('receiver_id' in value) ||
    !('amount' in value) ||
    !('status' in value)
  )
    return false;
  return (
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).sender_id === 'string' &&
    typeof (value as Record<string, unknown>).receiver_id === 'string' &&
    typeof (value as Record<string, unknown>).amount === 'number' &&
    typeof (value as Record<string, unknown>).status === 'string'
  );
}
=======
const RETRY_CONFIG = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60_000,
};

const SERVICE_NAME = 'escrow';
>>>>>>> origin/main

function toSummaryRow(row: EscrowRow): EscrowSummaryRow {
  return {
    id: row.id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    amount: row.amount,
    status: row.status,
    description: row.description,
    service_type: row.service_type,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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

<<<<<<< HEAD
    const supabase = this.supabaseService.getClient();

    // Verify receiver exists
    const receiverCheck = await supabase
      .from('users')
      .select('id')
      .eq('id', dto.partner_id)
      .maybeSingle();

    if (receiverCheck.error || !receiverCheck.data) {
      throw new NotFoundException('Partner user not found.');
    }

    // Get sender balance
    const balanceResponse = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', senderId)
      .single();

    const senderBalance = balanceResponse.data?.coins_balance ?? 0;

    if (senderBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient coin balance (${senderBalance} available, ${dto.amount} required).`,
      );
    }

    // Truncate description to safe length
    const description = dto.description.slice(0, 500);

    // Deduct coins from sender (hold in escrow)
    const newBalance = senderBalance - dto.amount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', senderId);

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to deduct coins from sender.',
      );
    }

    // Create escrow record
    const escrowPayload = {
      sender_id: senderId,
      receiver_id: dto.partner_id,
      amount: dto.amount,
      status: 'pending',
      description,
      service_type: dto.service_type ?? 'other',
=======
    const degradedMarker = {
      degraded: false,
      reason: undefined as string | undefined,
>>>>>>> origin/main
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

<<<<<<< HEAD
    const escrowData = await this.fetchPendingEscrow(dto.escrow_id);

    // Only the sender can release the escrow
    if (escrowData.sender_id !== callerId) {
      throw new ForbiddenException('Only the sender can release the escrow.');
    }

    // Credit receiver
    const { data: receiverData } = await supabase
=======
    // Check payer balance
    const { data: payerRow, error: payerError } = await supabase
>>>>>>> origin/main
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

    if (payerError || !payerRow) {
      throw new NotFoundException('Payer not found');
    }

<<<<<<< HEAD
    const { error: updateError } = await supabase
      .from('escrows')
      .update({ status: 'released' })
      .eq('id', dto.escrow_id);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update escrow status.');
    }

    this.logger.info(`Escrow ${dto.escrow_id} released.`);

    return {
      id: dto.escrow_id,
      status: 'released',
      amount_released: escrowData.amount,
      receiver_new_balance: newReceiverBalance,
    };
  }

  async refundEscrow(
    callerId: string,
    dto: RefundEscrowDto,
  ): Promise<EscrowRefundResult> {
    const escrowData = await this.fetchPendingEscrow(dto.escrow_id);

    // Only the sender can refund the escrow
    if (escrowData.sender_id !== callerId) {
      throw new ForbiddenException('Only the sender can request a refund.');
    }

    const newSenderBalance = await this.creditUser(
      escrowData.sender_id,
      escrowData.amount,
      'Failed to refund sender.',
    );

    // Update escrow status
    const supabase = this.supabaseService.getClient();
    const { error: updateError } = await supabase
      .from('escrows')
      .update({
        status: 'refunded',
        dispute_reason: dto.reason ? dto.reason.slice(0, 1000) : null,
      })
      .eq('id', dto.escrow_id);

    if (updateError) {
      throw new InternalServerErrorException('Failed to update escrow status.');
    }

    this.logger.info(`Escrow ${dto.escrow_id} refunded.`);

    return {
      id: dto.escrow_id,
      status: 'refunded',
      amount_refunded: escrowData.amount,
      sender_new_balance: newSenderBalance,
    };
  }

  async disputeEscrow(
    callerId: string,
    dto: DisputeEscrowDto,
  ): Promise<EscrowRow> {
    const escrowData = await this.fetchPendingEscrow(dto.escrow_id);

    const isParticipant =
      escrowData.sender_id === callerId ||
      escrowData.receiver_id === callerId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only participants in the escrow can raise a dispute.',
      );
    }

    const truncatedReason = dto.reason.slice(0, 1000);
    const truncatedEvidence = dto.evidence ? dto.evidence.slice(0, 5000) : null;

    const supabase = this.supabaseService.getClient();
    const { data: updated, error: updateError } = await supabase
      .from('escrows')
      .update({
        status: 'disputed',
        dispute_reason: truncatedReason,
        dispute_evidence: truncatedEvidence,
      })
      .eq('id', dto.escrow_id)
=======
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
<<<<<<< HEAD
      `Escrow ${dto.escrow_id} disputed by ${callerId}: ${truncatedReason.slice(0, 100)}`,
=======
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
>>>>>>> origin/main
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

<<<<<<< HEAD
    const truncatedNote = dto.admin_note ? dto.admin_note.slice(0, 2000) : null;

    if (dto.resolution === 'release') {
      const newReceiverBalance = await this.creditUser(
        escrowData.receiver_id,
        escrowData.amount,
        'Failed to credit receiver.',
      );

      const { error: updateError } = await supabase
        .from('escrows')
        .update({
          status: 'released',
          admin_note: truncatedNote,
        })
        .eq('id', dto.escrow_id);

      if (updateError) {
        throw new InternalServerErrorException(
          'Failed to update escrow resolution status.',
        );
      }

      this.logger.info(
        `Dispute for escrow ${dto.escrow_id} resolved by ${adminId}: released to receiver.`,
      );

      return {
        id: dto.escrow_id,
        status: 'released',
        amount_released: escrowData.amount,
        receiver_new_balance: newReceiverBalance,
      };
    }

    // Refund sender
    const newSenderBalance = await this.creditUser(
      escrowData.sender_id,
      escrowData.amount,
      'Failed to refund sender.',
    );

    const { error: updateError } = await supabase
      .from('escrows')
      .update({
        status: 'refunded',
        admin_note: truncatedNote,
      })
      .eq('id', dto.escrow_id);

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to update escrow resolution status.',
      );
    }

    this.logger.info(
      `Dispute for escrow ${dto.escrow_id} resolved by ${adminId}: refunded to sender.`,
    );

=======
    const now = new Date().toISOString();
>>>>>>> origin/main
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

<<<<<<< HEAD
  async listUserEscrows(
    userId: string,
    dto: ListEscrowDto,
  ): Promise<PaginatedEscrowResponse> {
    const supabase = this.supabaseService.getClient();

    if (
      dto.status &&
      !(VALID_ESCROW_STATUSES as readonly string[]).includes(dto.status)
    ) {
      throw new BadRequestException(
        `Invalid escrow status filter: ${dto.status}`,
      );
    }

    const limit = dto.limit ?? DEFAULT_PAGE_SIZE;
    const offset = dto.offset ?? 0;

    // Get total count for pagination metadata
    let countQuery = supabase
      .from('escrows')
      .select('id', { count: 'exact', head: true })
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    if (dto.status) {
      countQuery = countQuery.eq('status', dto.status);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      throw new InternalServerErrorException('Failed to count escrows.');
    }

    // Fetch paginated results, excluding large free-text fields from list
    let dataQuery = supabase
      .from('escrows')
      .select(
        'id, sender_id, receiver_id, amount, status, description, service_type, created_at, updated_at',
      )
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });
=======
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
>>>>>>> origin/main

    if (dto.status) {
      dataQuery = dataQuery.eq('status', dto.status);
    }

    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data, error } = await dataQuery;

    if (error || !data) {
      this.logger.error(
        `Failed to list escrow transactions for ${userId}: ${error?.message ?? 'no data returned'}`,
      );
      return [];
    }

<<<<<<< HEAD
    const rows = (data ?? [])
      .filter((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false;
        const record = item as Record<string, unknown>;
        return (
          typeof record.id === 'string' &&
          typeof record.sender_id === 'string' &&
          typeof record.receiver_id === 'string' &&
          typeof record.amount === 'number' &&
          typeof record.status === 'string'
        );
      })
      .map((item) => toSummaryRow(item as unknown as EscrowRow));

    return {
      data: rows,
      total: count ?? 0,
      limit,
      offset,
    };
  }

  // -- private helpers --

  /**
   * Fetch an escrow that must be in 'pending' status.
   * Throws NotFoundException if the escrow does not exist, or
   * BadRequestException if it is not pending.
   */
  private async fetchPendingEscrow(escrowId: string): Promise<EscrowRow> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data || !isEscrowRow(data)) {
      throw new NotFoundException(`Escrow '${escrowId}' not found.`);
    }

    if (data.status !== 'pending') {
      throw new BadRequestException(
        `Escrow cannot be modified because it is already ${data.status}.`,
      );
    }

    return data;
  }

  /**
   * Credit a user's coin balance by the specified amount.
   * Returns the new balance after the credit.
   * Throws InternalServerErrorException if the update fails.
   */
  private async creditUser(
    userId: string,
    amount: number,
    failureMessage: string,
  ): Promise<number> {
    const supabase = this.supabaseService.getClient();

    const { data: userData } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    const currentBalance = userData?.coins_balance ?? 0;
    const newBalance = currentBalance + amount;

    const { error } = await supabase
      .from('users')
      .update({ coins_balance: newBalance })
      .eq('id', userId);

    if (error) {
      throw new InternalServerErrorException(failureMessage);
    }

    return newBalance;
=======
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
