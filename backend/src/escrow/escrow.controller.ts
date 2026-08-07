import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import {
  EscrowRateLimit,
  EscrowRateLimiterGuard,
} from './escrow-rate-limiter.guard';

@Controller('escrow')
@UseGuards(SupabaseAuthGuard, EscrowRateLimiterGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EscrowRateLimit({ maxRequests: 5, windowSeconds: 60 })
  async createEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.createEscrow(user.id, dto);
  }

  @Post('release')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EscrowRateLimit({ maxRequests: 5, windowSeconds: 60 })
  async releaseEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: ReleaseEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.releaseEscrow(user.id, dto);
  }

  @Post('refund')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EscrowRateLimit({ maxRequests: 5, windowSeconds: 60 })
  async refundEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: RefundEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.refundEscrow(user.id, dto);
  }

  @Post('dispute')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @EscrowRateLimit({ maxRequests: 5, windowSeconds: 60 })
  async disputeEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: DisputeEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.disputeEscrow(user.id, dto);
  }

  @Post('resolve-dispute')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @EscrowRateLimit({ maxRequests: 15, windowSeconds: 60 })
  async resolveDispute(
    @CurrentUser() user: User | null,
    @Body() dto: ResolveDisputeDto,
  ) {
    if (!user) return null;
    return this.escrowService.resolveDispute(user.id, dto);
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getEscrow(@CurrentUser() user: User | null, @Param('id') id: string) {
    if (!user) return null;
    return this.escrowService.getEscrow(id);
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listEscrows(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
  ) {
    if (!user) return null;
    return this.escrowService.listUserEscrows(user.id, status);
  }
}
