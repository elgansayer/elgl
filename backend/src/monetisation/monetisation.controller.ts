import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
  Headers,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RequireVip } from './decorators/require-vip.decorator';
import { VipGuard } from './guards/vip.guard';
import {
  CreateDiagnosticLogDto,
  AppleReceiptValidationDto,
  CreateCheckoutSessionDto,
} from './dto/monetisation.dto';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { AppleNotificationDto } from './dto/apple-notification.dto';
import { GoogleNotificationDto } from './dto/google-notification.dto';

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
    return await this.monetisationService.handleStripeWebhook(
      req.rawBody,
      signature,
    );
  }

  @Post('webhooks/apple')
  @HttpCode(200)
  async handleAppleWebhook(@Body() dto: AppleNotificationDto) {
    return await this.monetisationService.handleAppleNotification(dto);
  }

  @Post('webhooks/google')
  @HttpCode(200)
  async handleGoogleWebhook(@Body() dto: GoogleNotificationDto) {
    return await this.monetisationService.handleGoogleNotification(dto);
  }

  @Post('generate-api-key')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  async generateApiKey(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.generateApiKey(user.id);
  }

  @Get('analytics')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  async getAnalytics(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDeveloperAnalytics(user.id);
  }

  @Get('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  async getDiagnosticLogs(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDiagnosticLogs(user.id);
  }

  @Post('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
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

  @Post('create-checkout-session')
  @UseGuards(SupabaseAuthGuard)
  async createCheckoutSession(
    @CurrentUser() user: User | null,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    if (!user) return null;
    return await this.monetisationService.createCheckoutSession(
      user.id,
      dto.planId,
      dto.interval,
    );
  }

  @Post('restore-purchases')
  @UseGuards(SupabaseAuthGuard)
  async restorePurchases(
    @CurrentUser() user: User | null,
    @Body() dto: { platform?: string; receipt_data?: string },
  ) {
    if (!user) return null;
    if (!dto.platform || !['ios', 'android'].includes(dto.platform)) {
      throw new BadRequestException('Platform must be "ios" or "android"');
    }
    return await this.monetisationService.restorePurchases(
      user.id,
      dto.platform as 'ios' | 'android',
      dto.receipt_data,
    );
  }

  @Get('coins-balance')
  @UseGuards(SupabaseAuthGuard)
  async getCoinsBalance(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getCoinsBalance(user.id);
  }

  /**
   * Get current subscription details for the authenticated user.
   */
  @Get('subscription')
  @UseGuards(SupabaseAuthGuard)
  async getSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getSubscriptionDetails(user.id);
  }

  /**
   * Cancel the user's subscription (set Stripe subscription to cancel at period end).
   */
  @Post('subscription/cancel')
  @UseGuards(SupabaseAuthGuard)
  async cancelSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.cancelSubscription(user.id);
  }

  /**
   * Resume a subscription previously scheduled to cancel at period end.
   */
  @Post('subscription/resume')
  @UseGuards(SupabaseAuthGuard)
  async resumeSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.resumeSubscription(user.id);
  }

  /**
   * List billing history (invoices) for the authenticated user.
   */
  @Get('subscription/invoices')
  @UseGuards(SupabaseAuthGuard)
  async getInvoices(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.listInvoices(user.id);
  }

  /**
   * Create a Stripe Billing Portal session for managing payment methods.
   */
  @Post('subscription/billing-portal')
  @UseGuards(SupabaseAuthGuard)
  async createBillingPortalSession(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.createBillingPortalSession(user.id);
  }
}
