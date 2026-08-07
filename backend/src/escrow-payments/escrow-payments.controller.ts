import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '@supabase/supabase-js';
import { EscrowPaymentsService } from './escrow-payments.service';
import { EscrowExceptionFilter } from './filters/escrow-exception.filter';
import {
  CreateEscrowDto,
  ReleaseEscrowDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  CancelEscrowDto,
  EscrowResponseDto,
} from './dto/escrow.dto';

@Controller('escrow-payments')
@UseGuards(SupabaseAuthGuard)
@UseFilters(EscrowExceptionFilter)
export class EscrowPaymentsController {
  constructor(private readonly escrowService: EscrowPaymentsService) {}

  @Post('create')
  async createEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CreateEscrowDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.createEscrow(user!.id, dto);
  }

  @Post('deposit')
  async depositFunds(
    @CurrentUser() user: User | null,
    @Body() dto: ReleaseEscrowDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.depositFunds(user!.id, dto.escrowId);
  }

  @Post('release')
  async releaseFunds(
    @CurrentUser() user: User | null,
    @Body() dto: ReleaseEscrowDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.releaseFunds(user!.id, dto.escrowId);
  }

  @Post('dispute')
  async openDispute(
    @CurrentUser() user: User | null,
    @Body() dto: RaiseDisputeDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.openDispute(
      user!.id,
      dto.escrowId,
      dto.reason,
    );
  }

  @Post('dispute/resolve')
  async resolveDispute(
    @CurrentUser() _user: User | null,
    @Body() dto: ResolveDisputeDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.resolveDispute(
      dto.escrowId,
      dto.resolution,
      dto.adminNotes,
    );
  }

  @Post('cancel')
  async cancelEscrow(
    @CurrentUser() user: User | null,
    @Body() dto: CancelEscrowDto,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.cancelEscrow(
      user!.id,
      dto.escrowId,
      dto.reason,
    );
  }

  @Get(':id')
  async getEscrow(
    @CurrentUser() user: User | null,
    @Param('id') id: string,
  ): Promise<EscrowResponseDto> {
    return await this.escrowService.getEscrow(user!.id, id);
  }

  @Get()
  async listEscrows(
    @CurrentUser() user: User | null,
  ): Promise<EscrowResponseDto[]> {
    return await this.escrowService.listUserEscrows(user!.id);
  }
}