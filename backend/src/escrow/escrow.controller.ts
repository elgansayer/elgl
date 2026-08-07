import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
} from './dto/escrow.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; email?: string };
}

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get('transactions')
  async listMyTransactions(@Req() req: AuthenticatedRequest) {
    return this.escrowService.getEscrowTransactionsForUser(req.user.id);
  }

  @Get('transactions/:id')
  async getTransaction(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.getEscrowTransactionById(id);
  }

  @Post('transactions')
  async createEscrow(
    @Body() dto: CreateEscrowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.createEscrow(req.user.id, dto);
  }

  @Post('release')
  async releaseEscrow(
    @Body() dto: ReleaseEscrowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.releaseEscrow(dto.escrow_id, req.user.id);
  }

  @Post('refund')
  async refundEscrow(
    @Body() dto: RefundEscrowDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.refundEscrow(dto.escrow_id, req.user.id);
  }

  @Get('transactions/:id/disputes')
  async getDisputes(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.escrowService.getDisputesForEscrowTransaction(id);
  }

  @Post('disputes')
  async raiseDispute(
    @Body() dto: RaiseDisputeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.raiseDispute(
      dto.escrow_transaction_id,
      req.user.id,
      dto.reason,
    );
  }

  @Post('disputes/resolve')
  @UseGuards(AdminGuard)
  async resolveDispute(
    @Body() dto: ResolveDisputeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.escrowService.resolveDispute(
      dto.dispute_id,
      dto.resolution,
      req.user.id,
      dto.resolution_notes,
    );
  }
}