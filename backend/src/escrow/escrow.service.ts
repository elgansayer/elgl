import {
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
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
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
>>>>>>> origin/main

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
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
  ) {}

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
        status: 'released' as EscrowStatus,
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
      throw new ForbiddenException(
        'Only the payer can refund escrowed funds.',
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
        status: 'refunded' as EscrowStatus,
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
  async getEscrow(userId: string, escrowId: string): Promise<EscrowTransaction> {
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
   */
  async listEscrows(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ escrows: EscrowTransaction[]; total: number }> {
    const supabase = this.supabaseService.getClient();

    const { data, error, count } = await supabase
      .from('escrow_transactions')
      .select('*', { count: 'exact' })
      .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException('Failed to fetch escrow transactions.');
    }

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
      );
    }

    return data as EscrowTransaction;
  }
}
>>>>>>> origin/main
