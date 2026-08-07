import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CreateEscrowDto,
  EscrowListQueryDto,
  ReleaseEscrowDto,
} from './dto/escrow.dto';
import { EscrowService } from './escrow.service';

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post('create')
  async createEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.createEscrow(user.id, dto);
  }

  @Post(':escrowId/resolve')
  async resolveEscrow(
    @CurrentUser() user: User | null,
    @Param('escrowId') escrowId: string,
    @Body() dto: ReleaseEscrowDto,
  ) {
    if (!user) return null;
    return this.escrowService.resolveEscrow(escrowId, user.id, dto);
  }

  @Get(':escrowId')
  async getEscrow(@Param('escrowId') escrowId: string) {
    return this.escrowService.getEscrowById(escrowId);
  }

  @Get()
  async listEscrows(
    @CurrentUser() user: User | null,
    @Query() query: EscrowListQueryDto,
  ) {
    if (!user) return { payments: [], total: 0, page: 1, pageSize: 20 };
    return this.escrowService.listEscrows(user.id, query);
  }
}
