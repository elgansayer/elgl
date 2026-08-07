import {
  BadRequestException,
  ConflictException,
  Injectable,
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
    const { data: payerRow, error: payerError } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', payerId)
      .single();

    if (payerError || !payerRow) {
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
      .insert({
        payer_id: payerId,
        payee_id: dto.payee_id,
        amount_coins: dto.amount_coins,
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

    // Credit coins to payee
    const { data: payeeRow, error: payeeError } = await supabase
      .from('users')
      .select('coins_balance')
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