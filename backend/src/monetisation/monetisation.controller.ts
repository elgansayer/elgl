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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
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

@ApiTags('Monetisation')
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
  @ApiOperation({
    summary: 'Handle Stripe webhook events',
    description:
      'Receives Stripe webhook events for subscription lifecycle management (checkout completed, invoice paid, subscription cancelled, etc.). Verifies the Stripe signature before processing. Called exclusively by Stripe servers.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature for verification',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Missing stripe signature or raw body',
  })
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
  @ApiOperation({
    summary: 'Handle Apple App Store server notifications',
    description:
      'Receives Apple App Store server notifications (v2) for subscription events, refunds, and renewal status changes. Verifies JWS signatures before processing. Called exclusively by Apple servers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Apple notification processed successfully',
  })
  async handleAppleWebhook(@Body() dto: AppleNotificationDto) {
    return await this.monetisationService.handleAppleNotification(dto);
  }

  @Post('webhooks/google')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Handle Google Play Pub/Sub notifications',
    description:
      'Receives Google Play Real-time Developer Notifications (RTDN) via Pub/Sub for subscription events, refunds, and status changes. Verifies Pub/Sub message authenticity before processing. Called exclusively by Google servers.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google notification processed successfully',
  })
  async handleGoogleWebhook(@Body() dto: GoogleNotificationDto) {
    return await this.monetisationService.handleGoogleNotification(dto);
  }

  @Post('generate-api-key')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Generate a developer API key',
    description:
      'Generates a new API key for programmatic access. Requires Developer-tier VIP subscription. The key allows authenticated access to developer endpoints with elevated rate limits.',
  })
  @ApiResponse({
    status: 200,
    description: 'API key generated successfully',
    schema: {
      type: 'object',
      properties: {
        api_key: { type: 'string', example: 'ht_dev_abc123def456' },
        created_at: { type: 'string', example: '2026-08-07T12:00:00Z' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorised - valid JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Developer-tier VIP required',
  })
  async generateApiKey(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.generateApiKey(user.id);
  }

  @Get('analytics')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get developer analytics dashboard data',
    description:
      'Returns API usage statistics, request counts, error rates, and performance metrics for the authenticated developer. Requires Developer-tier VIP subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'Developer analytics data',
    schema: {
      type: 'object',
      properties: {
        api_calls_total: { type: 'number', example: 15420 },
        api_calls_today: { type: 'number', example: 342 },
        error_rate: { type: 'number', example: 0.012 },
        rate_limit_remaining: { type: 'number', example: 258 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Developer-tier VIP required',
  })
  async getAnalytics(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDeveloperAnalytics(user.id);
  }

  @Get('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get diagnostic logs',
    description:
      'Returns recent diagnostic log entries for the developer, covering service health checks (PostGIS, Centrifugo, Redis, LiveKit). Requires Developer-tier VIP subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of diagnostic log entries',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'log_001' },
          category: { type: 'string', example: 'REDIS' },
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Redis connection pool healthy' },
          created_at: { type: 'string', example: '2026-08-07T12:00:00Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Developer-tier VIP required',
  })
  async getDiagnosticLogs(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getDiagnosticLogs(user.id);
  }

  @Post('diagnostics/logs')
  @UseGuards(SupabaseAuthGuard, VipGuard)
  @RequireVip('developer')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a diagnostic log entry',
    description:
      'Records a diagnostic check result for a backend service (PostGIS, Centrifugo, Redis, LiveKit). Requires Developer-tier VIP subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic log entry created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'log_001' },
        category: { type: 'string', example: 'REDIS' },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Redis connection pool healthy' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Developer-tier VIP required',
  })
  async createDiagnosticLog(
    @CurrentUser() user: User | null,
    @Body() dto: CreateDiagnosticLogDto,
  ) {
    if (!user) return null;
    return await this.monetisationService.createDiagnosticLog(user.id, dto);
  }

  @Post('validate-apple-receipt')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validate an Apple App Store receipt',
    description:
      "Validates an Apple App Store in-app purchase receipt with Apple's verifyReceipt API. Used for purchase verification and subscription restoration on iOS.",
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt validation result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', example: true },
        product_id: { type: 'string', example: 'com.hellotalk.vip.monthly' },
        expiration_date: { type: 'string', example: '2026-09-07T12:00:00Z' },
        tier: { type: 'string', example: 'consumer_8_ukp_10_usd' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid receipt data' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a Stripe Checkout session for subscription',
    description:
      'Creates a Stripe Checkout session for purchasing a VIP subscription plan. Supports monthly and yearly billing intervals.',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkout session created',
    schema: {
      type: 'object',
      properties: {
        sessionUrl: {
          type: 'string',
          example: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3',
        },
        sessionId: { type: 'string', example: 'cs_test_a1b2c3d4e5f6' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid plan ID or interval' })
  @ApiResponse({ status: 404, description: 'Subscription plan not found' })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Restore previous in-app purchases',
    description:
      "Restores previously purchased VIP subscriptions across platforms (iOS, Android, Stripe). Verifies purchase history with the relevant store and updates the user's VIP tier if applicable.",
  })
  @ApiResponse({
    status: 200,
    description: 'Purchase restoration result',
    schema: {
      type: 'object',
      properties: {
        restored: { type: 'boolean', example: true },
        tier: { type: 'string', example: 'consumer_8_ukp_10_usd' },
        expires_at: { type: 'string', example: '2026-09-07T12:00:00Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid platform specified' })
  async restorePurchases(
    @CurrentUser() user: User | null,
    @Body() dto: { platform?: string; receipt_data?: string },
  ) {
    if (!user) return null;
    const platform = dto.platform || 'stripe';
    if (!['ios', 'android', 'stripe'].includes(platform)) {
      throw new BadRequestException(
        'Platform must be "ios", "android", or "stripe"',
      );
    }
    return await this.monetisationService.restorePurchases(
      user.id,
      platform as 'ios' | 'android' | 'stripe',
      dto.receipt_data,
    );
  }

  @Get('coins-balance')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user coin balance',
    description:
      "Returns the authenticated user's current virtual coin balance. Part of the monetisation module for consolidated financial data access.",
  })
  @ApiResponse({
    status: 200,
    description: 'Current coin balance',
    schema: {
      type: 'object',
      properties: {
        coins_balance: { type: 'number', example: 250 },
      },
    },
  })
  async getCoinsBalance(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getCoinsBalance(user.id);
  }

  /**
   * Get current subscription details for the authenticated user.
   */
  @Get('subscription')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current subscription details',
    description:
      "Returns the authenticated user's current VIP subscription status, including tier, renewal date, and whether cancellation is scheduled.",
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription details',
    schema: {
      type: 'object',
      properties: {
        tier: { type: 'string', example: 'consumer_8_ukp_10_usd' },
        is_vip: { type: 'boolean', example: true },
        current_period_end: { type: 'string', example: '2026-09-07T12:00:00Z' },
        cancel_at_period_end: { type: 'boolean', example: false },
        status: { type: 'string', example: 'active' },
      },
    },
  })
  async getSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.getSubscriptionDetails(user.id);
  }

  /**
   * Cancel the user's subscription (set Stripe subscription to cancel at period end).
   */
  @Post('subscription/cancel')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cancel subscription',
    description:
      'Schedules the current VIP subscription for cancellation at the end of the current billing period. The user retains VIP access until the period ends. Stripe will not renew the subscription.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancellation scheduled',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        current_period_end: { type: 'string', example: '2026-09-07T12:00:00Z' },
        message: {
          type: 'string',
          example:
            'Subscription will be cancelled at the end of the billing period',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async cancelSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.cancelSubscription(user.id);
  }

  /**
   * Resume a subscription previously scheduled to cancel at period end.
   */
  @Post('subscription/resume')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Resume subscription',
    description:
      'Resumes a subscription that was previously scheduled for cancellation at period end. The subscription will continue to auto-renew.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription resumed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        cancel_at_period_end: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Subscription will continue to auto-renew',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  @ApiResponse({
    status: 400,
    description: 'Subscription is not scheduled for cancellation',
  })
  async resumeSubscription(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.resumeSubscription(user.id);
  }

  /**
   * List billing history (invoices) for the authenticated user.
   */
  @Get('subscription/invoices')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get billing invoices',
    description:
      "Returns the authenticated user's billing history, including paid invoices and upcoming invoice preview from Stripe.",
  })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
    schema: {
      type: 'object',
      properties: {
        invoices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'in_123456' },
              amount_paid: { type: 'number', example: 1000 },
              currency: { type: 'string', example: 'usd' },
              status: { type: 'string', example: 'paid' },
              created: { type: 'number', example: 1691234567 },
              invoice_pdf: {
                type: 'string',
                example: 'https://invoice.stripe.com/...',
              },
            },
          },
        },
      },
    },
  })
  async getInvoices(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.listInvoices(user.id);
  }

  /**
   * Create a Stripe Billing Portal session for managing payment methods.
   */
  @Post('subscription/billing-portal')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create Stripe Billing Portal session',
    description:
      'Creates a Stripe Customer Billing Portal session, allowing the user to manage payment methods, view invoices, and update billing details.',
  })
  @ApiResponse({
    status: 200,
    description: 'Billing portal URL',
    schema: {
      type: 'object',
      properties: {
        portalUrl: {
          type: 'string',
          example: 'https://billing.stripe.com/session/...',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No Stripe customer found for this user',
  })
  async createBillingPortalSession(@CurrentUser() user: User | null) {
    if (!user) return null;
    return await this.monetisationService.createBillingPortalSession(user.id);
  }
}
