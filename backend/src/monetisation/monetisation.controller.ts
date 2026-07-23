import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  Headers,
  Req,
  RawBodyRequest,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  CreateDiagnosticLogDto,
  AppleReceiptValidationDto,
} from './dto/monetisation.dto';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

@Controller('monetisation')
export class MonetisationController {
  constructor(
    private readonly monetisationService: MonetisationService,
    private readonly appleReceiptValidatorService: AppleReceiptValidatorService,
  ) {}

  // NOTE: VIP status changes must ONLY occur via verified payment webhooks.
  // Do NOT add any endpoint that directly updates is_vip or vip_tier.
  // All VIP updates go through MonetisationService.updateVipStatusFromWebhook()
  // which is called exclusively from webhook handlers and receipt validators.

  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature || !req.rawBody) {
      throw new BadRequestException('Missing stripe signature or raw body');
    }
    return await this.monetisationService.handleStripeWebhook(req.rawBody, signature);
  }

  @Post('generate-api-key')
  @UseGuards(SupabaseAuthGuard)
  async generateApiKey(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.generateApiKey(user.id);
  }

  @Get('analytics')
  @UseGuards(SupabaseAuthGuard)
  async getAnalytics(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDeveloperAnalytics(user.id);
  }

  @Get('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard)
  async getDiagnosticLogs() {
    return await this.monetisationService.getDiagnosticLogs();
  }

  @Post('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard)
  async createDiagnosticLog(
    @CurrentUser() user: User | null,
    @Body() dto: CreateDiagnosticLogDto,
  ) {
    if (!user) return null;
    return await this.monetisationService.createDiagnosticLog(user.id, dto);
  }

  @Post('validate-apple-receipt')
  @UseGuards(SupabaseAuthGuard)
  async validateAppleReceipt(
    @CurrentUser() user: User | null,
    @Body() dto: AppleReceiptValidationDto,
  ) {
    if (!user) return null;
    return await this.appleReceiptValidatorService.validateReceipt(
      user.id,
      dto.receipt_data,
      dto.exclude_old_transactions,
    );
  }
}
