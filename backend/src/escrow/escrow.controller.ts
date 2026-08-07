import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
<<<<<<< HEAD
<<<<<<< HEAD
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ReleaseMilestoneDto } from './dto/release-milestone.dto';
import { DisputeEscrowDto } from './dto/dispute-escrow.dto';
import type { Request } from 'express';
=======
=======
  Post,
>>>>>>> origin/main
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
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEscrow(@Body() dto: CreateEscrowDto, @Req() req: Request) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.createEscrow(userId, dto);
  }

  @Get()
  async getUserEscrows(@Req() req: Request) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.getUserEscrows(userId);
  }

  @Get(':id')
  async getEscrow(@Param('id') id: string, @Req() req: Request) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.getEscrow(userId, id);
  }

  @Get(':id/milestones')
  async getMilestones(@Param('id') id: string, @Req() req: Request) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.getMilestones(userId, id);
  }

  @Post('release-milestone')
  @HttpCode(HttpStatus.OK)
  async releaseMilestone(
    @Body() dto: ReleaseMilestoneDto,
    @Req() req: Request,
  ) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.releaseMilestone(userId, dto);
  }

  @Post('dispute')
  @HttpCode(HttpStatus.CREATED)
  async disputeEscrow(@Body() dto: DisputeEscrowDto, @Req() req: Request) {
    const userId =
      ((req as unknown as Record<string, unknown>).user?.id as string) ?? '';
    return this.escrowService.disputeEscrow(userId, dto);
  }

  @Post('scrub-expired')
  @HttpCode(HttpStatus.OK)
  async scrubExpiredData() {
    return this.escrowService.scrubExpiredData();
  }

  @Post(':id/pii-report')
  @HttpCode(HttpStatus.OK)
  async getPiiReport(@Param('id') id: string) {
    return this.escrowService.getPiiReport(id);
  }
}
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
  ): Promise<EscrowTransactionResponse> {
    return this.escrowService.getTransaction(id, req.user.sub);
  }
<<<<<<< HEAD
}
>>>>>>> origin/main
=======

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
