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
  StripeWebhookDto,
  UpgradeVipDto,
} from './dto/monetisation.dto';
import { MonetisationService } from './monetisation.service';

@Controller('monetisation')
export class MonetisationController {
  constructor(private readonly monetisationService: MonetisationService) {}

  @Post('upgrade')
  @UseGuards(SupabaseAuthGuard)
  async upgradeVip(
    @CurrentUser() user: User | null,
    @Body() dto: UpgradeVipDto,
  ) {
    if (!user) return null;
    return await this.monetisationService.upgradeUser(user.id, dto);
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleWebhook(
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
}
