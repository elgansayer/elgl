import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';
import {
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
  EscrowReleaseResult,
  EscrowRefundResult,
} from './interfaces/escrow.interface';

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
  constructor(
    @InjectPinoLogger(EscrowService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  async createEscrow(
    senderId: string,
    dto: CreateEscrowDto,
  ): Promise<EscrowCreateResult> {
    if (senderId === dto.partner_id) {
      throw new BadRequestException(
        'You cannot create an escrow with yourself as the partner.',
      );
    }

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
    };

    const { data: escrowData, error: insertError } = await supabase
      .from('escrows')
      .insert(escrowPayload)
      .select('*')
      .single();

    if (insertError || !escrowData || !isEscrowRow(escrowData)) {
      // Rollback coin deduction
      await supabase
        .from('users')
        .update({ coins_balance: senderBalance })
        .eq('id', senderId);
      throw new InternalServerErrorException('Failed to create escrow record.');
    }

    this.logger.info(
      `Escrow ${escrowData.id} created: ${senderId} -> ${dto.partner_id}, ${dto.amount} coins`,
    );

    return {
      id: escrowData.id,
      status: 'pending',
      amount_held: dto.amount,
      coins_remaining: newBalance,
    };
  }

  async releaseEscrow(
    callerId: string,
    dto: ReleaseEscrowDto,
  ): Promise<EscrowReleaseResult> {
    const supabase = this.supabaseService.getClient();

    const escrowData = await this.fetchPendingEscrow(dto.escrow_id);

    // Only the sender can release the escrow
    if (escrowData.sender_id !== callerId) {
      throw new ForbiddenException('Only the sender can release the escrow.');
    }

    // Credit receiver
    const { data: receiverData } = await supabase
      .from('users')
      .select('coins_balance')
      .eq('id', escrowData.receiver_id)
      .single();

    const receiverBalance = receiverData?.coins_balance ?? 0;
    const newReceiverBalance = receiverBalance + escrowData.amount;

    const { error: creditError } = await supabase
      .from('users')
      .update({ coins_balance: newReceiverBalance })
      .eq('id', escrowData.receiver_id);

    if (creditError) {
      throw new InternalServerErrorException('Failed to credit receiver.');
    }

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
      .select('*')
      .single();

    if (updateError || !updated || !isEscrowRow(updated)) {
      throw new InternalServerErrorException(
        'Failed to update escrow dispute status.',
      );
    }

    this.logger.warn(
      `Escrow ${dto.escrow_id} disputed by ${callerId}: ${truncatedReason.slice(0, 100)}`,
    );

    return updated;
  }

  async resolveDispute(
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<EscrowReleaseResult | EscrowRefundResult> {
    const supabase = this.supabaseService.getClient();

    const { data: escrowData, error } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', dto.escrow_id)
      .single();

    if (error || !escrowData || !isEscrowRow(escrowData)) {
      throw new NotFoundException(`Escrow '${dto.escrow_id}' not found.`);
    }

    if (escrowData.status !== 'disputed') {
      throw new BadRequestException(
        `Only disputed escrows can be resolved. This escrow is ${escrowData.status}.`,
      );
    }

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

    return {
      id: dto.escrow_id,
      status: 'refunded',
      amount_refunded: escrowData.amount,
      sender_new_balance: newSenderBalance,
    };
  }

  async getEscrow(escrowId: string): Promise<EscrowRow> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('escrows')
      .select('*')
      .eq('id', escrowId)
      .single();

    if (error || !data || !isEscrowRow(data)) {
      throw new NotFoundException(`Escrow '${escrowId}' not found.`);
    }

    return data;
  }

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

    if (dto.status) {
      dataQuery = dataQuery.eq('status', dto.status);
    }

    dataQuery = dataQuery.range(offset, offset + limit - 1);

    const { data, error } = await dataQuery;

    if (error) {
      throw new InternalServerErrorException('Failed to retrieve escrows.');
    }

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
  }
}
