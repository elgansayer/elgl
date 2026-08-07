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
import { withRetry } from '../common/retry';
import {
  CreateEscrowDto,
  DisputeEscrowDto,
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
    typeof value.id === 'string' &&
    typeof value.sender_id === 'string' &&
    typeof value.receiver_id === 'string' &&
    typeof value.amount === 'number' &&
    typeof value.status === 'string'
  );
}

@Injectable()
export class EscrowService {
  constructor(
    @InjectPinoLogger(EscrowService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Wraps a Supabase operation with exponential backoff retry logic for HTTP 429.
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    return withRetry(operation, { logger: this.logger });
  }

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
    const receiverCheck = await this.withRetry(() =>
      supabase
        .from('users')
        .select('id')
        .eq('id', dto.partner_id)
        .maybeSingle(),
    );

    if (receiverCheck.error || !receiverCheck.data) {
      throw new NotFoundException('Partner user not found.');
    }

    // Get sender balance
    const balanceResponse = await this.withRetry(() =>
      supabase
        .from('users')
        .select('coins_balance')
        .eq('id', senderId)
        .single(),
    );

    const senderBalance = balanceResponse.data?.coins_balance ?? 0;

    if (senderBalance < dto.amount) {
      throw new BadRequestException(
        `Insufficient coin balance (${senderBalance} available, ${dto.amount} required).`,
      );
    }

    // Deduct coins from sender (hold in escrow)
    const newBalance = senderBalance - dto.amount;
    const { error: updateError } = await this.withRetry(() =>
      supabase
        .from('users')
        .update({ coins_balance: newBalance })
        .eq('id', senderId),
    );

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
      description: dto.description,
      service_type: dto.service_type ?? 'other',
    };

    const { data: escrowData, error: insertError } = await this.withRetry(() =>
      supabase.from('escrows').insert(escrowPayload).select('*').single(),
    );

    if (insertError || !escrowData || !isEscrowRow(escrowData)) {
      // Rollback coin deduction
      await this.withRetry(() =>
        supabase
          .from('users')
          .update({ coins_balance: senderBalance })
          .eq('id', senderId),
      );
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

    const { data: escrowData, error } = await this.withRetry(() =>
      supabase.from('escrows').select('*').eq('id', dto.escrow_id).single(),
    );

    if (error || !escrowData || !isEscrowRow(escrowData)) {
      throw new NotFoundException(`Escrow '${dto.escrow_id}' not found.`);
    }

    if (escrowData.status !== 'pending') {
      throw new BadRequestException(
        `Escrow cannot be released because it is already ${escrowData.status}.`,
      );
    }

    // Only the sender can release the escrow
    if (escrowData.sender_id !== callerId) {
      throw new ForbiddenException('Only the sender can release the escrow.');
    }

    // Credit receiver
    const { data: receiverData } = await this.withRetry(() =>
      supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrowData.receiver_id)
        .single(),
    );

    const receiverBalance = receiverData?.coins_balance ?? 0;
    const newReceiverBalance = receiverBalance + escrowData.amount;

    const { error: creditError } = await this.withRetry(() =>
      supabase
        .from('users')
        .update({ coins_balance: newReceiverBalance })
        .eq('id', escrowData.receiver_id),
    );

    if (creditError) {
      throw new InternalServerErrorException('Failed to credit receiver.');
    }

    // Update escrow status
    const { error: updateError } = await this.withRetry(() =>
      supabase
        .from('escrows')
        .update({ status: 'released' })
        .eq('id', dto.escrow_id),
    );

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
    const supabase = this.supabaseService.getClient();

    const { data: escrowData, error } = await this.withRetry(() =>
      supabase.from('escrows').select('*').eq('id', dto.escrow_id).single(),
    );

    if (error || !escrowData || !isEscrowRow(escrowData)) {
      throw new NotFoundException(`Escrow '${dto.escrow_id}' not found.`);
    }

    if (escrowData.status !== 'pending') {
      throw new BadRequestException(
        `Escrow cannot be refunded because it is already ${escrowData.status}.`,
      );
    }

    // Only the sender can refund the escrow
    if (escrowData.sender_id !== callerId) {
      throw new ForbiddenException('Only the sender can request a refund.');
    }

    // Refund sender
    const { data: senderData } = await this.withRetry(() =>
      supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrowData.sender_id)
        .single(),
    );

    const senderBalance = senderData?.coins_balance ?? 0;
    const newSenderBalance = senderBalance + escrowData.amount;

    const { error: refundError } = await this.withRetry(() =>
      supabase
        .from('users')
        .update({ coins_balance: newSenderBalance })
        .eq('id', escrowData.sender_id),
    );

    if (refundError) {
      throw new InternalServerErrorException('Failed to refund sender.');
    }

    // Update escrow status
    const { error: updateError } = await this.withRetry(() =>
      supabase
        .from('escrows')
        .update({
          status: 'refunded',
          dispute_reason: dto.reason ?? null,
        })
        .eq('id', dto.escrow_id),
    );

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
    const supabase = this.supabaseService.getClient();

    const { data: escrowData, error } = await this.withRetry(() =>
      supabase.from('escrows').select('*').eq('id', dto.escrow_id).single(),
    );

    if (error || !escrowData || !isEscrowRow(escrowData)) {
      throw new NotFoundException(`Escrow '${dto.escrow_id}' not found.`);
    }

    if (escrowData.status !== 'pending') {
      throw new BadRequestException(
        `Escrow cannot be disputed because it is already ${escrowData.status}.`,
      );
    }

    const isParticipant =
      escrowData.sender_id === callerId || escrowData.receiver_id === callerId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'Only participants in the escrow can raise a dispute.',
      );
    }

    const { data: updated, error: updateError } = await this.withRetry(() =>
      supabase
        .from('escrows')
        .update({
          status: 'disputed',
          dispute_reason: dto.reason,
          dispute_evidence: dto.evidence ?? null,
        })
        .eq('id', dto.escrow_id)
        .select('*')
        .single(),
    );

    if (updateError || !updated || !isEscrowRow(updated)) {
      throw new InternalServerErrorException(
        'Failed to update escrow dispute status.',
      );
    }

    this.logger.warn(
      `Escrow ${dto.escrow_id} disputed by ${callerId}: ${dto.reason}`,
    );

    return updated;
  }

  async resolveDispute(
    adminId: string,
    dto: ResolveDisputeDto,
  ): Promise<EscrowReleaseResult | EscrowRefundResult> {
    const supabase = this.supabaseService.getClient();

    const { data: escrowData, error } = await this.withRetry(() =>
      supabase.from('escrows').select('*').eq('id', dto.escrow_id).single(),
    );

    if (error || !escrowData || !isEscrowRow(escrowData)) {
      throw new NotFoundException(`Escrow '${dto.escrow_id}' not found.`);
    }

    if (escrowData.status !== 'disputed') {
      throw new BadRequestException(
        `Only disputed escrows can be resolved. This escrow is ${escrowData.status}.`,
      );
    }

    if (dto.resolution === 'release') {
      // Credit receiver
      const { data: receiverData } = await this.withRetry(() =>
        supabase
          .from('users')
          .select('coins_balance')
          .eq('id', escrowData.receiver_id)
          .single(),
      );

      const receiverBalance = receiverData?.coins_balance ?? 0;
      const newReceiverBalance = receiverBalance + escrowData.amount;

      const { error: creditError } = await this.withRetry(() =>
        supabase
          .from('users')
          .update({ coins_balance: newReceiverBalance })
          .eq('id', escrowData.receiver_id),
      );

      if (creditError) {
        throw new InternalServerErrorException('Failed to credit receiver.');
      }

      const { error: updateError } = await this.withRetry(() =>
        supabase
          .from('escrows')
          .update({
            status: 'released',
            admin_note: dto.admin_note ?? null,
          })
          .eq('id', dto.escrow_id),
      );

      if (updateError) {
        throw new InternalServerErrorException(
          'Failed to update escrow resolution status.',
        );
      }

      this.logger.info(
        `Dispute for escrow ${dto.escrow_id} resolved: released to receiver.`,
      );

      return {
        id: dto.escrow_id,
        status: 'released',
        amount_released: escrowData.amount,
        receiver_new_balance: newReceiverBalance,
      };
    }

    // Refund sender
    const { data: senderData } = await this.withRetry(() =>
      supabase
        .from('users')
        .select('coins_balance')
        .eq('id', escrowData.sender_id)
        .single(),
    );

    const senderBalance = senderData?.coins_balance ?? 0;
    const newSenderBalance = senderBalance + escrowData.amount;

    const { error: refundError } = await this.withRetry(() =>
      supabase
        .from('users')
        .update({ coins_balance: newSenderBalance })
        .eq('id', escrowData.sender_id),
    );

    if (refundError) {
      throw new InternalServerErrorException('Failed to refund sender.');
    }

    const { error: updateError } = await this.withRetry(() =>
      supabase
        .from('escrows')
        .update({
          status: 'refunded',
          admin_note: dto.admin_note ?? null,
        })
        .eq('id', dto.escrow_id),
    );

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to update escrow resolution status.',
      );
    }

    this.logger.info(
      `Dispute for escrow ${dto.escrow_id} resolved: refunded to sender.`,
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

    const { data, error } = await this.withRetry(() =>
      supabase.from('escrows').select('*').eq('id', escrowId).single(),
    );

    if (error || !data || !isEscrowRow(data)) {
      throw new NotFoundException(`Escrow '${escrowId}' not found.`);
    }

    return data;
  }

  async listUserEscrows(userId: string, status?: string): Promise<EscrowRow[]> {
    const supabase = this.supabaseService.getClient();

    if (
      status &&
      !['pending', 'released', 'refunded', 'disputed', 'cancelled'].includes(
        status,
      )
    ) {
      throw new BadRequestException(`Invalid escrow status filter: ${status}`);
    }

    let query = supabase
      .from('escrows')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await this.withRetry(() => query);

    if (error) {
      throw new InternalServerErrorException('Failed to retrieve escrows.');
    }

    const escrows = (data ?? []).filter(
      (item: unknown): item is EscrowRow =>
        typeof item === 'object' &&
        item !== null &&
        'id' in item &&
        'sender_id' in item &&
        'receiver_id' in item &&
        'amount' in item &&
        'status' in item,
    );

    return escrows;
  }
}
