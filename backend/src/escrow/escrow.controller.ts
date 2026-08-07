import {
  Body,
  Controller,
  Get,
<<<<<<< HEAD
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
=======
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowHoldDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  CancelEscrowDto,
  EscrowTransactionResponse,
  CircuitBreakerStatusResponse,
} from './dto/escrow.dto';
import { EscrowStatus } from './interfaces/escrow-transaction.interface';

interface AuthenticatedRequest {
  user: { sub: string };
}

@ApiTags('Escrow')
@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('hold')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hold coins in escrow for a transaction' })
  async holdCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEscrowHoldDto,
  ) {
    return this.escrowService.holdCoins(req.user.sub, dto);
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release held escrow coins to the payee' })
  async releaseCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ReleaseEscrowDto,
  ) {
    return this.escrowService.releaseCoins(dto.transaction_id, req.user.sub);
  }

  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refund escrow coins back to the payer' })
  async refundCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RefundEscrowDto,
  ) {
    return this.escrowService.refundCoins(
      dto.transaction_id,
      req.user.sub,
>>>>>>> origin/main
      dto.reason,
    );
  }

<<<<<<< HEAD
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
=======
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an escrow transaction' })
  async cancelEscrow(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CancelEscrowDto,
  ) {
    return this.escrowService.cancelEscrow(dto.transaction_id, req.user.sub);
  }

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List escrow transactions for the current user' })
  async listTransactions(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: EscrowStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<EscrowTransactionResponse[]> {
    return this.escrowService.listTransactions(
      req.user.sub,
      status,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('transactions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get an escrow transaction by ID' })
  async getTransaction(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<EscrowTransactionResponse> {
    return this.escrowService.getTransaction(id, req.user.sub);
  }

  @Get('circuit-breaker/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get circuit breaker status for escrow service' })
  getCircuitBreakerStatus(): CircuitBreakerStatusResponse {
    return this.escrowService.getCircuitBreakerStatus();
  }

  @Post('circuit-breaker/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset circuit breaker for escrow service (admin)' })
  resetCircuitBreaker(): { reset: boolean } {
    this.escrowService.resetCircuitBreaker();
    return { reset: true };
  }
}
>>>>>>> origin/main
