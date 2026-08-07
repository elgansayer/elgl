import {
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

@Controller('escrow')
@UseGuards(SupabaseAuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

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
  }
}