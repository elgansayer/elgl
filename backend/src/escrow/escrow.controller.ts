import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CancelEscrowDto,
  CreateEscrowDto,
  DisputeEscrowDto,
  RefundEscrowDto,
  ReleaseEscrowDto,
  ResolveDisputeDto,
} from './dto/escrow.dto';
import { EscrowService } from './escrow.service';

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create')
  async createEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.createEscrow(user.id, dto);
  }

  @Post('release')
  async releaseEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: ReleaseEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.releaseEscrow(user.id, dto);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async releaseEscrowById(
    @CurrentUser() user: User | null,
    @Param('id') escrowId: string,
  ) {
    if (!user) return null;
    return this.escrowService.releaseEscrow(user.id, { escrow_id: escrowId });
  }

  @Post('refund')
  async refundEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: RefundEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.refundEscrow(user.id, dto);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refundEscrowById(
    @CurrentUser() user: User | null,
    @Param('id') escrowId: string,
    @Body() dto: Omit<RefundEscrowDto, 'escrow_id'>,
  ) {
    if (!user) return null;
    return this.escrowService.refundEscrow(user.id, {
      escrow_id: escrowId,
      ...dto,
    });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelEscrowById(
    @CurrentUser() user: User | null,
    @Param('id') escrowId: string,
  ) {
    if (!user) return null;
    return this.escrowService.cancelEscrow(user.id, { escrow_id: escrowId });
  }

  @Post('dispute')
  async disputeEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: DisputeEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.disputeEscrow(user.id, dto);
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  async disputeEscrowById(
    @CurrentUser() user: User | null,
    @Param('id') escrowId: string,
    @Body() dto: Omit<DisputeEscrowDto, 'escrow_id'>,
  ) {
    if (!user) return null;
    return this.escrowService.disputeEscrow(user.id, {
      escrow_id: escrowId,
      ...dto,
    });
  }

  @Post('resolve-dispute')
  async resolveDispute(
    @CurrentUser() user: User | null,
    @Body() dto: ResolveDisputeDto,
  ) {
    if (!user) return null;
    return this.escrowService.resolveDispute(user.id, dto);
  }

  @Get('history')
  async getEscrowHistory(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    if (!user) return null;
    return this.escrowService.getEscrowHistory(user.id, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      sortBy,
      order,
    });
  }

  @Get('outgoing')
  async listOutgoingEscrows(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
  ) {
    if (!user) return null;
    return this.escrowService.listOutgoingEscrows(user.id, status);
  }

  @Get('incoming')
  async listIncomingEscrows(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
  ) {
    if (!user) return null;
    return this.escrowService.listIncomingEscrows(user.id, status);
  }

  @Get('summary')
  async getEscrowSummary(@CurrentUser() user: User | null) {
    if (!user) return null;
    return this.escrowService.getEscrowSummary(user.id);
  }

  @Get(':id')
  async getEscrow(@CurrentUser() user: User | null, @Param('id') id: string) {
    if (!user) return null;
    return this.escrowService.getEscrow(id);
  }

  @Get()
  async listEscrows(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
  ) {
    if (!user) return null;
    return this.escrowService.listUserEscrows(user.id, status);
  }
}
