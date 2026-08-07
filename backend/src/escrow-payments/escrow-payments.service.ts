import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { AnalyticsService } from '../analytics/analytics.service';
import {
  CreateEscrowDto,
  EscrowResponseDto,
  EscrowStatus,
  EscrowEventType,
  EscrowEventPayloadDto,
} from './dto/escrow.dto';
import {
  EscrowNotFoundException,
  EscrowInsufficientFundsException,
  EscrowInvalidStateException,
  EscrowAlreadyDisputedException,
  EscrowExpiredException,
  EscrowPaymentGatewayException,
  EscrowUnauthorisedException,
} from './exceptions/escrow.exceptions';

interface EscrowRow {
  id: string;
  party_a_id: string;
  party_b_id: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  description?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  dispute_reason?: string | null;
  dispute_opened_at?: string | null;
  resolution?: string | null;
  admin_notes?: string | null;
  cancelled_reason?: string | null;
}

@Injectable()
export class EscrowPaymentsService {
  private readonly logger = new Logger(EscrowPaymentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly analyticsService: AnalyticsService,
    private readonly configService: ConfigService,
  ) {}

  // ---- Escrow lifecycle operations ----

  async createEscrow(
    partyAId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowResponseDto> {
    this.logger.log(
      `Creating escrow: partyA=${partyAId}, partyB=${dto.partyBId}, amount=${dto.amount} ${dto.currency}`,
    );

    if (partyAId === dto.partyBId) {
      throw new EscrowInvalidStateException('CREATE', 'cannot escrow with self', ['valid counterparty']);
    }

    const expiresInDays = dto.expiresInDays ?? 30;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .insert({
        party_a_id: partyAId,
        party_b_id: dto.partyBId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description ?? null,
        status: EscrowStatus.AWAITING_DEPOSIT,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to create escrow: ${error?.message ?? 'no data returned'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Database insert failed',
        { partyAId, partyBId: dto.partyBId },
      );
    }

    const row = data as unknown as EscrowRow;
    return this.toResponse(row);
  }

  async depositFunds(
    userId: string,
    escrowId: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);
    this.requireParty(escrow, userId, 'party_a_id');

    if (escrow.status !== EscrowStatus.AWAITING_DEPOSIT) {
      throw new EscrowInvalidStateException(escrowId, escrow.status, [
        EscrowStatus.AWAITING_DEPOSIT,
      ]);
    }

    if (new Date(escrow.expires_at) < new Date()) {
      throw new EscrowExpiredException(escrowId, escrow.expires_at);
    }

    // Simulate payment gateway check -- in production, integrate with real payment processor
    await this.verifyUserFunds(userId, escrow.amount);

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .update({
        status: EscrowStatus.FUNDS_HELD,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('status', EscrowStatus.AWAITING_DEPOSIT)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to update escrow status to funds_held: ${error?.message ?? 'no data'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Status update failed',
        { escrowId },
      );
    }

    await this.emitEscrowEvent({
      escrowId,
      eventType: EscrowEventType.FUNDS_DEPOSITED,
      partyAId: escrow.party_a_id,
      partyBId: escrow.party_b_id,
      amount: escrow.amount,
      currency: escrow.currency,
      timestamp: new Date().toISOString(),
    });

    return this.toResponse(data as unknown as EscrowRow);
  }

  async releaseFunds(
    userId: string,
    escrowId: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);
    this.requireParty(escrow, userId, 'party_a_id');

    if (escrow.status !== EscrowStatus.FUNDS_HELD) {
      throw new EscrowInvalidStateException(escrowId, escrow.status, [
        EscrowStatus.FUNDS_HELD,
      ]);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .update({
        status: EscrowStatus.RELEASED,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('status', EscrowStatus.FUNDS_HELD)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to release escrow funds: ${error?.message ?? 'no data'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Release failed',
        { escrowId },
      );
    }

    await this.emitEscrowEvent({
      escrowId,
      eventType: EscrowEventType.FUNDS_RELEASED,
      partyAId: escrow.party_a_id,
      partyBId: escrow.party_b_id,
      amount: escrow.amount,
      currency: escrow.currency,
      timestamp: new Date().toISOString(),
    });

    return this.toResponse(data as unknown as EscrowRow);
  }

  async openDispute(
    userId: string,
    escrowId: string,
    reason: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);

    if (
      escrow.party_a_id !== userId &&
      escrow.party_b_id !== userId
    ) {
      throw new EscrowUnauthorisedException(userId, escrowId);
    }

    if (escrow.status === EscrowStatus.DISPUTED) {
      throw new EscrowAlreadyDisputedException(escrowId);
    }

    if (escrow.status !== EscrowStatus.FUNDS_HELD) {
      throw new EscrowInvalidStateException(escrowId, escrow.status, [
        EscrowStatus.FUNDS_HELD,
      ]);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .update({
        status: EscrowStatus.DISPUTED,
        dispute_reason: reason,
        dispute_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to open dispute for escrow ${escrowId}: ${error?.message ?? 'no data'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Dispute open failed',
        { escrowId },
      );
    }

    await this.emitEscrowEvent({
      escrowId,
      eventType: EscrowEventType.DISPUTE_OPENED,
      partyAId: escrow.party_a_id,
      partyBId: escrow.party_b_id,
      amount: escrow.amount,
      currency: escrow.currency,
      metadata: { reason },
      timestamp: new Date().toISOString(),
    });

    return this.toResponse(data as unknown as EscrowRow);
  }

  async resolveDispute(
    escrowId: string,
    resolution: 'release_to_party_b' | 'refund_to_party_a',
    adminNotes?: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new EscrowInvalidStateException(escrowId, escrow.status, [
        EscrowStatus.DISPUTED,
      ]);
    }

    const newStatus =
      resolution === 'release_to_party_b'
        ? EscrowStatus.RELEASED
        : EscrowStatus.REFUNDED;

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .update({
        status: newStatus,
        resolution,
        admin_notes: adminNotes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('status', EscrowStatus.DISPUTED)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to resolve dispute for escrow ${escrowId}: ${error?.message ?? 'no data'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Dispute resolution failed',
        { escrowId, resolution },
      );
    }

    await this.emitEscrowEvent({
      escrowId,
      eventType: EscrowEventType.DISPUTE_RESOLVED,
      partyAId: escrow.party_a_id,
      partyBId: escrow.party_b_id,
      amount: escrow.amount,
      currency: escrow.currency,
      metadata: { resolution, adminNotes },
      timestamp: new Date().toISOString(),
    });

    return this.toResponse(data as unknown as EscrowRow);
  }

  async cancelEscrow(
    userId: string,
    escrowId: string,
    reason?: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);
    this.requireParty(escrow, userId, 'party_a_id');

    if (
      escrow.status === EscrowStatus.RELEASED ||
      escrow.status === EscrowStatus.REFUNDED
    ) {
      throw new EscrowInvalidStateException(escrowId, escrow.status, [
        EscrowStatus.AWAITING_DEPOSIT,
        EscrowStatus.FUNDS_HELD,
        EscrowStatus.DISPUTED,
      ]);
    }

    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .update({
        status: EscrowStatus.CANCELLED,
        cancelled_reason: reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error(
        `Failed to cancel escrow ${escrowId}: ${error?.message ?? 'no data'}`,
      );
      throw new EscrowPaymentGatewayException(
        error?.message ?? 'Cancellation failed',
        { escrowId },
      );
    }

    await this.emitEscrowEvent({
      escrowId,
      eventType: EscrowEventType.ESCROW_CANCELLED,
      partyAId: escrow.party_a_id,
      partyBId: escrow.party_b_id,
      amount: escrow.amount,
      currency: escrow.currency,
      metadata: { reason },
      timestamp: new Date().toISOString(),
    });

    return this.toResponse(data as unknown as EscrowRow);
  }

  async getEscrow(
    userId: string,
    escrowId: string,
  ): Promise<EscrowResponseDto> {
    const escrow = await this.requireEscrow(escrowId);

    if (
      escrow.party_a_id !== userId &&
      escrow.party_b_id !== userId
    ) {
      throw new EscrowUnauthorisedException(userId, escrowId);
    }

    return this.toResponse(escrow);
  }

  async listUserEscrows(userId: string): Promise<EscrowResponseDto[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .select('*')
      .or(`party_a_id.eq.${userId},party_b_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(
        `Failed to list escrows for user ${userId}: ${error.message}`,
      );
      throw new EscrowPaymentGatewayException(error.message, { userId });
    }

    return (data as unknown as EscrowRow[] ?? []).map((row) =>
      this.toResponse(row),
    );
  }

  // ---- Helpers ----

  private async requireEscrow(escrowId: string): Promise<EscrowRow> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('escrow_payments')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
      throw new EscrowNotFoundException(escrowId);
    }

    return data as unknown as EscrowRow;
  }

  private requireParty(
    escrow: EscrowRow,
    userId: string,
    expectedField: 'party_a_id' | 'party_b_id',
  ): void {
    const expectedParty = escrow[expectedField];
    if (expectedParty !== userId) {
      throw new EscrowUnauthorisedException(userId, escrow.id);
    }
  }

  private async verifyUserFunds(
    userId: string,
    amount: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new EscrowPaymentGatewayException(
        `Failed to verify funds for user ${userId}`,
        { userId },
      );
    }

    const balance: number = data.coins_balance ?? 0;
    if (balance < amount) {
      throw new EscrowInsufficientFundsException(userId, amount, balance);
    }
  }

  private async emitEscrowEvent(
    payload: EscrowEventPayloadDto,
  ): Promise<void> {
    try {
      // In production, publish to Centrifugo for real-time notifications
      this.logger.log(
        `Escrow event: ${payload.eventType} for escrow ${payload.escrowId}`,
      );
      // await this.centrifugoService.publish(`escrow:${payload.escrowId}`, payload);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to emit escrow event: ${(err as Error).message}`,
      );
    }
  }

  private toResponse(row: EscrowRow): EscrowResponseDto {
    return {
      id: row.id,
      partyAId: row.party_a_id,
      partyBId: row.party_b_id,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      description: row.description ?? undefined,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}