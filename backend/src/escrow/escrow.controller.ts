import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { EscrowService } from './escrow.service';
import { CreateEscrowDto, ReleaseEscrowDto, RefundEscrowDto } from './dto/escrow.dto';
>>>>>>> origin/main

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

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
>>>>>>> origin/main
