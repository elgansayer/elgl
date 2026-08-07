import {
<<<<<<< HEAD
<<<<<<< HEAD
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EscrowService } from './escrow.service';
import { CreateEscrowPaymentDto } from './dto/create-escrow-payment.dto';
import { UpdateEscrowPaymentDto } from './dto/update-escrow-payment.dto';
=======
  Controller,
  Post,
  Get,
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
import { CreateEscrowDto, ReleaseEscrowDto, RefundEscrowDto } from './dto/escrow.dto';
>>>>>>> origin/main
=======
import {
  CreateEscrowHoldDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  CancelEscrowDto,
  EscrowTransactionResponse,
  CircuitBreakerStatusResponse,
} from './dto/escrow.dto';
import { EscrowStatus } from './interfaces/escrow-transaction.interface';
>>>>>>> origin/main

interface AuthenticatedRequest {
  user: { sub: string };
}

@ApiTags('Escrow')
@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
@ApiBearerAuth()
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

<<<<<<< HEAD
<<<<<<< HEAD
  @Post('payments')
  async createPayment(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowPaymentDto,
  ) {
    if (!user) return null;
    return this.escrowService.createPayment(user.id, dto);
  }

  @Get('payments')
  async getUserPayments(@CurrentUser() user: User | null) {
    if (!user) return [];
    return this.escrowService.getUserPayments(user.id);
  }

  @Get('payments/:id')
  async getPayment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ) {
    if (!user) return null;
    return this.escrowService.getPayment(id, user.id);
  }

  @Post('payments/:id/fund')
  async fundPayment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ) {
    if (!user) return null;
    return this.escrowService.fundPayment(id, user.id);
  }

  @Put('payments/:id')
  async updatePayment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
    @Body() dto: UpdateEscrowPaymentDto,
  ) {
    if (!user) return null;

    switch (dto.action) {
      case 'approve_delivery':
        return this.escrowService.approveDelivery(id, user.id);
      case 'raise_dispute':
        return this.escrowService.raiseDispute(id, user.id, dto.reason ?? 'No reason provided');
      case 'cancel':
        return this.escrowService.cancelPayment(id, user.id);
      default:
        return null;
    }
  }

  @Post('payments/:id/complete')
  async completePayment(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ) {
    if (!user) return null;
    return this.escrowService.completePayment(id, user.id);
=======
  /**
   * POST /escrow/create
   * Create a new escrow transaction, holding coins from the payer.
   * Rate limited to 5 requests per minute.
   */
  @Post('create')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async create(
    @Req() req: { user?: { id?: string } },
    @Body() dto: CreateEscrowDto,
=======
  @Post('hold')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hold coins in escrow for a transaction' })
  async holdCoins(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEscrowHoldDto,
>>>>>>> origin/main
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
<<<<<<< HEAD
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.getEscrow(userId, id);
>>>>>>> origin/main
=======
  ): Promise<EscrowTransactionResponse> {
    return this.escrowService.getTransaction(id, req.user.sub);
>>>>>>> origin/main
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
