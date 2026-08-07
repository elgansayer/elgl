import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  OnModuleDestroy,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
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

@Injectable()
export class EscrowService implements OnModuleDestroy {
  private readonly logger = new Logger(EscrowService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
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

  /** Release the cleanup timer to prevent memory leaks on module teardown. */
  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Create an escrow transaction: lock the payer's coins until the payee
   * fulfills their obligation or the escrow is refunded.
   *
   * Idempotency: if an idempotency_key is provided, duplicate submissions
   * for the same payer+key will return the existing escrow instead of
   * creating a duplicate.
   */
  async createEscrow(
    payerId: string,
    dto: CreateEscrowDto,
  ): Promise<CreateEscrowResult> {
    if (payerId === dto.payee_id) {
      throw new BadRequestException(
        'You cannot create an escrow with yourself as the payee.',
      );
    }

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
      .from('users')
      .select('id')
      .eq('id', dto.payee_id)
      .single();

    if (payeeError || !payee) {
      throw new NotFoundException('Payee user not found.');
    }

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
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
        status: 'held' as EscrowStatus,
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
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Escrow transaction ${escrowId} not found.`);
    }

    return data;
  }

  /**
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
   */
  private async cleanupExpiredEscrows(): Promise<void> {
    // Stale threshold: escrows held for more than 30 days without release/refund
    const threshold = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const supabase = this.supabaseService.getClient();
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

      if (error || !expired || expired.length === 0) break;

      for (const row of expired) {
        const record = row;
        try {
          await this.refundEscrow(record.payer_id, record.id);
          totalRefunded++;
        } catch (err: unknown) {
          this.logger.warn(
            `Cleanup: could not auto-refund escrow ${record.id}: ${(err as Error)?.message ?? 'unknown'}`,
          );
        }
      }
    }

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
      );
    }
  }
}
