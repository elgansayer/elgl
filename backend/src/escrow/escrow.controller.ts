import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { EscrowService } from './escrow.service';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
} from './dto/escrow.dto';

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

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
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.createEscrow(userId, dto);
  }

  /**
   * POST /escrow/release
   * Release escrowed coins to the payee.
   * Rate limited to 5 requests per minute.
   */
  @Post('release')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async release(
    @Req() req: { user?: { id?: string } },
    @Body() dto: ReleaseEscrowDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.releaseEscrow(userId, dto.escrow_id);
  }

  /**
   * POST /escrow/refund
   * Refund escrowed coins back to the payer.
   * Rate limited to 5 requests per minute.
   */
  @Post('refund')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refund(
    @Req() req: { user?: { id?: string } },
    @Body() dto: RefundEscrowDto,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.refundEscrow(userId, dto.escrow_id);
  }

  /**
   * GET /escrow/list
   * List escrow transactions for the authenticated user.
   * Rate limited to 20 requests per minute.
   */
  @Get('list')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async list(
    @Req() req: { user?: { id?: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.listEscrows(
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  /**
   * GET /escrow/:id
   * Get a single escrow transaction by ID.
   * Rate limited to 30 requests per minute.
   */
  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getById(
    @Req() req: { user?: { id?: string } },
    @Param('id') id: string,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException();
    }
    return this.escrowService.getEscrow(userId, id);
  }
}
