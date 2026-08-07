import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

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
