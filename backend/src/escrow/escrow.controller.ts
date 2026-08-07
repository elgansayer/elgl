import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CacheControlInterceptor,
  CACHE_PRIVATE_NO_STORE,
  CACHE_PRIVATE_SHORT,
} from '../common/cache.interceptor';
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

  /**
   * Escrow creation is a mutation that deducts coins - never cached.
   */
  @Post('create')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async createEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.createEscrow(user.id, dto);
  }

  /**
   * Escrow release is a monetary mutation - never cached.
   */
  @Post('release')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async releaseEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: ReleaseEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.releaseEscrow(user.id, dto);
  }

  /**
   * Escrow refund is a monetary mutation - never cached.
   */
  @Post('refund')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async refundEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: RefundEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.refundEscrow(user.id, dto);
  }

  /**
   * Dispute raising is a state mutation - never cached.
   */
  @Post('dispute')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async disputeEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: DisputeEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.disputeEscrow(user.id, dto);
  }

  /**
   * Dispute resolution is a monetary mutation - never cached.
   */
  @Post('resolve-dispute')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_NO_STORE))
  async resolveDispute(
    @CurrentUser() user: User | null,
    @Body() dto: ResolveDisputeDto,
  ) {
    if (!user) return null;
    return this.escrowService.resolveDispute(user.id, dto);
  }

  /**
   * Single escrow read: private user-specific data.
   * Browsers may cache briefly (60 s) but CDN edge MUST NOT store.
   */
  @Get(':id')
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_SHORT))
  async getEscrow(@CurrentUser() user: User | null, @Param('id') id: string) {
    if (!user) return null;
    return this.escrowService.getEscrow(id);
  }

  /**
   * User escrow list: private user-specific data.
   * Browsers may cache briefly (60 s) but CDN edge MUST NOT store.
   */
  @Get()
  @UseInterceptors(new CacheControlInterceptor(CACHE_PRIVATE_SHORT))
  async listEscrows(
    @CurrentUser() user: User | null,
    @Query('status') status?: string,
  ) {
    if (!user) return null;
    return this.escrowService.listUserEscrows(user.id, status);
  }
}
