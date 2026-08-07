import {
  Body,
  Controller,
  Get,
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
      dto.reason,
    );
  }

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
