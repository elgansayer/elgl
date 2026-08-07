import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
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

  @Post('refund')
  async refundEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: RefundEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.refundEscrow(user.id, dto);
  }

  @Post('dispute')
  async disputeEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: DisputeEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.disputeEscrow(user.id, dto);
  }

  @Post('resolve-dispute')
  async resolveDispute(
    @CurrentUser() user: User | null,
    @Body() dto: ResolveDisputeDto,
  ) {
    if (!user) return null;
    return this.escrowService.resolveDispute(user.id, dto);
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
