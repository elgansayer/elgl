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
import {
  EscrowTransaction,
  EscrowStatus,
  CreateEscrowResult,
  ReleaseEscrowResult,
  RefundEscrowResult,
} from './interfaces/escrow.interface';
import { CreateEscrowDto } from './dto/escrow.dto';

/** Maximum items per page to bound payload sizes (audit #2396). */
const MAX_LIST_LIMIT = 50;
/** Expiry cleanup interval in ms (6 hours). */
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Max records to process per expiry cleanup batch. */
const CLEANUP_BATCH_SIZE = 100;

@Injectable()
export class EscrowService implements OnModuleDestroy {
  private readonly logger = new Logger(EscrowService.name);
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly monetisationService: MonetisationService,
  ) {
    // Periodic cleanup of stale held escrows to prevent resource leaks
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

    // Create the escrow record
    const { data: escrow, error: escrowError } = await supabase
      .from('escrow_transactions')
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
        status: 'held' as EscrowStatus,
        description: dto.description ?? null,
        reference_id: dto.reference_id ?? null,
      })
      .select(
        'id, payer_id, payee_id, amount_coins, status, description, reference_id, created_at, updated_at',
      )
      .single();

    if (escrowError || !escrow) {
      // Refund coins if escrow record creation fails
      this.logger.error(
        `Failed to create escrow record: ${escrowError?.message}, refunding coins to payer ${payerId}`,
      );
      await this.monetisationService.addCoins(payerId, dto.amount_coins);
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

    if (escrow.status !== 'held') {
      throw new ConflictException(
        `Escrow is not in 'held' status (current: ${escrow.status}).`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('escrow_transactions')
      .update({
        status: 'released',
        released_at: now,
        updated_at: now,
      })
      .eq('id', escrowId)
      .eq('status', 'held');

    if (updateError) {
      throw new BadRequestException('Failed to release escrow.');
    }

    const payeeBalance = await this.monetisationService.addCoins(
      escrow.payee_id,
      escrow.amount_coins,
    );

    this.logger.log(
      `Escrow ${escrowId} released: ${escrow.amount_coins} coins to ${escrow.payee_id}`,
    );

    return {
      id: escrowId,
      status: 'released',
      amount_coins: escrow.amount_coins,
      payee_balance: payeeBalance,
    };
  }

  /**
   * Refund escrowed coins back to the payer. Only the payer can refund.
   * Coins are returned to the original payer.
   */
  async refundEscrow(
    userId: string,
    escrowId: string,
  ): Promise<RefundEscrowResult> {
    const escrow = await this.findEscrowOrThrow(escrowId);

    if (escrow.payer_id !== userId) {
      throw new ForbiddenException('Only the payer can refund escrowed funds.');
    }

    if (escrow.status !== 'held') {
      throw new ConflictException(
        `Escrow is not in 'held' status (current: ${escrow.status}).`,
      );
    }

    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('escrow_transactions')
      .update({
        status: 'refunded',
        refunded_at: now,
        updated_at: now,
      })
      .eq('id', escrowId)
      .eq('status', 'held');

    if (updateError) {
      throw new BadRequestException('Failed to refund escrow.');
    }

    const payerBalance = await this.monetisationService.addCoins(
      escrow.payer_id,
      escrow.amount_coins,
    );

    this.logger.log(
      `Escrow ${escrowId} refunded: ${escrow.amount_coins} coins returned to ${escrow.payer_id}`,
    );

    return {
      id: escrowId,
      status: 'refunded',
      amount_coins: escrow.amount_coins,
      payer_balance: payerBalance,
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
   * Periodically refund held escrows that have been dormant beyond a configurable
   * threshold to prevent stale escrows from accumulating indefinitely.
   * Memory leak audit (#2396): batch-limited to avoid large in-memory result sets.
   */
  private async cleanupExpiredEscrows(): Promise<void> {
    // Stale threshold: escrows held for more than 30 days without release/refund
    const threshold = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const supabase = this.supabaseService.getClient();
    let totalRefunded = 0;

    while (true) {
      const { data: expired, error } = await supabase
        .from('escrow_transactions')
        .select('id, payer_id, amount_coins')
        .eq('status', 'held')
        .lt('created_at', threshold)
        .limit(CLEANUP_BATCH_SIZE);

      if (error || !expired || expired.length === 0) break;

      for (const row of expired) {
        const record = row as { id: string; payer_id: string; amount_coins: number };
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

    if (totalRefunded > 0) {
      this.logger.log(
        `Expired escrow cleanup: auto-refunded ${totalRefunded} escrows`,
      );
    }
  }
}
