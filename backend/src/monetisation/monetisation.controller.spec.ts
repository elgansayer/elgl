import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PATH_METADATA } from '@nestjs/common/constants';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VipGuard } from './guards/vip.guard';
import { BadRequestException } from '@nestjs/common';

describe('MonetisationController', () => {
  let controller: MonetisationController;
  let monetisationService: MonetisationService;
  let appleReceiptValidatorService: AppleReceiptValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonetisationController],
      providers: [
        {
          provide: MonetisationService,
          useValue: {
            handleStripeWebhook: vi.fn(),
            handleAppleNotification: vi.fn(),
            handleGoogleNotification: vi.fn(),
            generateApiKey: vi.fn(),
            getDeveloperAnalytics: vi.fn(),
            getDiagnosticLogs: vi.fn(),
            createDiagnosticLog: vi.fn(),
            createCheckoutSession: vi.fn(),
            restorePurchases: vi.fn(),
            getSubscriptionDetails: vi.fn(),
            cancelSubscription: vi.fn(),
            resumeSubscription: vi.fn(),
            listInvoices: vi.fn(),
            createBillingPortalSession: vi.fn(),
          },
        },
        {
          provide: AppleReceiptValidatorService,
          useValue: {
            validateReceipt: vi.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .overrideGuard(VipGuard)
      .useValue({ canActivate: vi.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MonetisationController>(MonetisationController);
    monetisationService = module.get<MonetisationService>(MonetisationService);
    appleReceiptValidatorService = module.get<AppleReceiptValidatorService>(
      AppleReceiptValidatorService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    it('should throw BadRequestException if signature is missing', async () => {
      await expect(
        controller.handleStripeWebhook('', { rawBody: Buffer.from('') } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should pass webhook DTO to service and return result', async () => {
      const response = { received: true, status: 'processed' };
      (monetisationService.handleStripeWebhook as Mock).mockResolvedValue(
        response,
      );
      const rawBody = Buffer.from('test');

      const result = await controller.handleStripeWebhook('sig', {
        rawBody,
      } as any);
      expect(monetisationService.handleStripeWebhook).toHaveBeenCalledWith(
        rawBody,
        'sig',
      );
      expect(result).toEqual(response);
    });
  });

  describe('handleAppleWebhook', () => {
    it('should pass webhook payload to service', async () => {
      const payload = { notificationType: 'test' };
      const response = { received: true, status: 'processed' };
      (monetisationService.handleAppleNotification as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.handleAppleWebhook(payload);
      expect(monetisationService.handleAppleNotification).toHaveBeenCalledWith(
        payload,
      );
      expect(result).toEqual(response);
    });
  });

  describe('handleGoogleWebhook', () => {
    it('should pass webhook payload to service', async () => {
      const payload = { version: '1.0' };
      const response = { received: true, status: 'processed' };
      (monetisationService.handleGoogleNotification as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.handleGoogleWebhook(payload);
      expect(monetisationService.handleGoogleNotification).toHaveBeenCalledWith(
        payload,
      );
      expect(result).toEqual(response);
    });
  });

  describe('generateApiKey', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.generateApiKey(null);
      expect(result).toBeNull();
      expect(monetisationService.generateApiKey).not.toHaveBeenCalled();
    });

    it('should call service generateApiKey when user is provided', async () => {
      const response = {
        api_key: 'ht_dev_key',
        tier: 'developer',
        rate_limit_rpm: 600,
      };
      (monetisationService.generateApiKey as Mock).mockResolvedValue(response);

      const result = await controller.generateApiKey({ id: 'user-1' } as any);
      expect(monetisationService.generateApiKey).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('getAnalytics', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getAnalytics(null);
      expect(result).toBeNull();
      expect(monetisationService.getDeveloperAnalytics).not.toHaveBeenCalled();
    });

    it('should call service getDeveloperAnalytics when user is provided', async () => {
      const response = {
        api_key: 'ht_dev_key',
        tier: 'developer',
        total_api_calls_today: 1420,
        avg_latency_ms: 18,
        pricing_info: 'Developer Tier',
      };
      (monetisationService.getDeveloperAnalytics as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.getAnalytics({ id: 'user-1' } as any);
      expect(monetisationService.getDeveloperAnalytics).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });
  });

  describe('getDiagnosticLogs', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getDiagnosticLogs(null);
      expect(result).toBeNull();
      expect(monetisationService.getDiagnosticLogs).not.toHaveBeenCalled();
    });

    it('should return logs from service when user is provided', async () => {
      const logs = [{ id: 'log-1', category: 'POSTGIS' }];
      (monetisationService.getDiagnosticLogs as Mock).mockResolvedValue(logs);

      const result = await controller.getDiagnosticLogs({
        id: 'user-1',
      } as any);
      expect(monetisationService.getDiagnosticLogs).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(logs);
    });
  });

  describe('createDiagnosticLog', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createDiagnosticLog(null, {} as any);
      expect(result).toBeNull();
      expect(monetisationService.createDiagnosticLog).not.toHaveBeenCalled();
    });

    it('should create log through service when user is provided', async () => {
      const dto: any = {
        category: 'REDIS',
        status: 'success',
        message: 'ok',
      };
      const log = { id: 'log-2', ...dto };
      (monetisationService.createDiagnosticLog as Mock).mockResolvedValue(log);

      const result = await controller.createDiagnosticLog(
        { id: 'user-1' } as any,
        dto,
      );
      expect(monetisationService.createDiagnosticLog).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
      expect(result).toEqual(log);
    });
  });

  describe('createCheckoutSession', () => {
    it('should return null if user is not provided', async () => {
      const dto = {
        planId: 'consumer_8_ukp_10_usd',
        interval: 'month' as const,
      };
      const result = await controller.createCheckoutSession(null, dto);
      expect(result).toBeNull();
      expect(monetisationService.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('should call service.createCheckoutSession with correct parameters for monthly plan', async () => {
      const dto = {
        planId: 'consumer_8_ukp_10_usd',
        interval: 'month' as const,
      };
      const mockResponse = {
        sessionUrl: 'https://checkout.stripe.com/session_123',
        sessionId: 'cs_test_abc123',
      };
      (monetisationService.createCheckoutSession as Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await controller.createCheckoutSession(
        { id: 'user-1' } as any,
        dto,
      );

      expect(monetisationService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'consumer_8_ukp_10_usd',
        'month',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call service.createCheckoutSession with correct parameters for yearly plan', async () => {
      const dto = {
        planId: 'consumer_50_ukp_63_usd',
        interval: 'year' as const,
      };
      const mockResponse = {
        sessionUrl: 'https://checkout.stripe.com/session_456',
        sessionId: 'cs_test_def456',
      };
      (monetisationService.createCheckoutSession as Mock).mockResolvedValue(
        mockResponse,
      );

      const result = await controller.createCheckoutSession(
        { id: 'user-1' } as any,
        dto,
      );

      expect(monetisationService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'consumer_50_ukp_63_usd',
        'year',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should propagate service errors', async () => {
      const dto = { planId: 'invalid_plan', interval: 'month' as const };
      const error = new Error('Plan not found');
      (monetisationService.createCheckoutSession as Mock).mockRejectedValue(
        error,
      );

      await expect(
        controller.createCheckoutSession({ id: 'user-1' } as any, dto),
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('validateAppleReceipt', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.validateAppleReceipt(null, {} as any);
      expect(result).toBeNull();
      expect(
        appleReceiptValidatorService.validateReceipt,
      ).not.toHaveBeenCalled();
    });

    it('should call appleReceiptValidatorService.validateReceipt when user is provided', async () => {
      const dto: any = {
        receipt_data: 'token123',
        exclude_old_transactions: true,
      };
      const response = { valid: true };
      (appleReceiptValidatorService.validateReceipt as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.validateAppleReceipt(
        { id: 'user-1' } as any,
        dto,
      );
      expect(appleReceiptValidatorService.validateReceipt).toHaveBeenCalledWith(
        'user-1',
        'token123',
        true,
      );
      expect(result).toEqual(response);
    });
  });

  describe('getSubscription', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getSubscription(null);
      expect(result).toBeNull();
      expect(monetisationService.getSubscriptionDetails).not.toHaveBeenCalled();
    });

    it('should call service.getSubscriptionDetails when user is provided', async () => {
      const response = {
        isVip: true,
        vipTier: 'consumer',
        email: 'user@example.com',
        billing: null,
      };
      (monetisationService.getSubscriptionDetails as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.getSubscription({ id: 'user-1' } as any);
      expect(monetisationService.getSubscriptionDetails).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });
  });

  describe('cancelSubscription', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.cancelSubscription(null);
      expect(result).toBeNull();
      expect(monetisationService.cancelSubscription).not.toHaveBeenCalled();
    });

    it('should call service.cancelSubscription when user is provided', async () => {
      const response = { message: 'cancelled' };
      (monetisationService.cancelSubscription as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.cancelSubscription({
        id: 'user-1',
      } as any);
      expect(monetisationService.cancelSubscription).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });
  });

  describe('resumeSubscription', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.resumeSubscription(null);
      expect(result).toBeNull();
      expect(monetisationService.resumeSubscription).not.toHaveBeenCalled();
    });

    it('should call service.resumeSubscription when user is provided', async () => {
      const response = { message: 'resumed' };
      (monetisationService.resumeSubscription as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.resumeSubscription({
        id: 'user-1',
      } as any);
      expect(monetisationService.resumeSubscription).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });
  });

  describe('getInvoices', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.getInvoices(null);
      expect(result).toBeNull();
      expect(monetisationService.listInvoices).not.toHaveBeenCalled();
    });

    it('should call service.listInvoices when user is provided', async () => {
      const response = [
        {
          id: 'in_1',
          amountPaid: 8,
          currency: 'gbp',
          status: 'paid',
          created: '2026-01-01T00:00:00.000Z',
          invoicePdf: null,
          hostedInvoiceUrl: null,
        },
      ];
      (monetisationService.listInvoices as Mock).mockResolvedValue(response);

      const result = await controller.getInvoices({ id: 'user-1' } as any);
      expect(monetisationService.listInvoices).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('createBillingPortalSession', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.createBillingPortalSession(null);
      expect(result).toBeNull();
      expect(
        monetisationService.createBillingPortalSession,
      ).not.toHaveBeenCalled();
    });

    it('should call service.createBillingPortalSession when user is provided', async () => {
      const response = { url: 'https://billing.stripe.com/session/test' };
      (
        monetisationService.createBillingPortalSession as Mock
      ).mockResolvedValue(response);

      const result = await controller.createBillingPortalSession({
        id: 'user-1',
      } as any);
      expect(
        monetisationService.createBillingPortalSession,
      ).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(response);
    });
  });

  describe('restorePurchases', () => {
    it('should return null if user is not provided', async () => {
      const result = await controller.restorePurchases(null, {
        platform: 'ios',
      });
      expect(result).toBeNull();
      expect(monetisationService.restorePurchases).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid platform', async () => {
      await expect(
        controller.restorePurchases({ id: 'user-1' } as any, {
          platform: 'windows',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should default to stripe when platform is empty', async () => {
      const response = { received: true, status: 'restored' };
      (monetisationService.restorePurchases as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.restorePurchases(
        { id: 'user-1' } as any,
        { platform: '' },
      );

      expect(monetisationService.restorePurchases).toHaveBeenCalledWith(
        'user-1',
        'stripe',
        undefined,
      );
      expect(result).toEqual(response);
    });

    it('should default to stripe when platform is not provided', async () => {
      const response = { received: true, status: 'restored' };
      (monetisationService.restorePurchases as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.restorePurchases(
        { id: 'user-1' } as any,
        {},
      );

      expect(monetisationService.restorePurchases).toHaveBeenCalledWith(
        'user-1',
        'stripe',
        undefined,
      );
      expect(result).toEqual(response);
    });

    it('should accept ios platform', async () => {
      const response = { received: true, status: 'restored' };
      (monetisationService.restorePurchases as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.restorePurchases(
        { id: 'user-1' } as any,
        { platform: 'ios', receipt_data: 'test-receipt' },
      );
      expect(monetisationService.restorePurchases).toHaveBeenCalledWith(
        'user-1',
        'ios',
        'test-receipt',
      );
      expect(result).toEqual(response);
    });

    it('should accept android platform', async () => {
      const response = { received: true, status: 'restored' };
      (monetisationService.restorePurchases as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.restorePurchases(
        { id: 'user-1' } as any,
        { platform: 'android', receipt_data: 'test-token' },
      );
      expect(monetisationService.restorePurchases).toHaveBeenCalledWith(
        'user-1',
        'android',
        'test-token',
      );
      expect(result).toEqual(response);
    });

    it('should accept stripe platform', async () => {
      const response = { received: true, status: 'restored' };
      (monetisationService.restorePurchases as Mock).mockResolvedValue(
        response,
      );

      const result = await controller.restorePurchases(
        { id: 'user-1' } as any,
        { platform: 'stripe' },
      );
      expect(monetisationService.restorePurchases).toHaveBeenCalledWith(
        'user-1',
        'stripe',
        undefined,
      );
      expect(result).toEqual(response);
    });
  });
});

describe('MonetisationController VIP upgrade lockdown (regression guard)', () => {
  it('should never register a route path named "upgrade": VIP status must only change via verified payment webhooks', () => {
    const routePaths = Object.getOwnPropertyNames(
      MonetisationController.prototype,
    )
      .filter((name) => name !== 'constructor')
      .map((name) =>
        Reflect.getMetadata(
          PATH_METADATA,
          MonetisationController.prototype[
            name as keyof typeof MonetisationController.prototype
          ],
        ),
      );

    expect(routePaths).not.toContain('upgrade');
    expect(
      Object.getOwnPropertyNames(MonetisationController.prototype),
    ).not.toContain('upgrade');
  });
});
