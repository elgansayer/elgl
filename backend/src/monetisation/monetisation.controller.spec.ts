import { Test, TestingModule } from '@nestjs/testing';
import { MonetisationController } from './monetisation.controller';
import { MonetisationService } from './monetisation.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
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
            handleStripeWebhook: jest.fn(),
            handleAppleWebhook: jest.fn(),
            handleGoogleWebhook: jest.fn(),
            generateApiKey: jest.fn(),
            getDeveloperAnalytics: jest.fn(),
            getDiagnosticLogs: jest.fn(),
            createDiagnosticLog: jest.fn(),
            createCheckoutSession: jest.fn(),
          },
        },
        {
          provide: AppleReceiptValidatorService,
          useValue: {
            validateReceipt: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MonetisationController>(MonetisationController);
    monetisationService = module.get<MonetisationService>(MonetisationService);
    appleReceiptValidatorService = module.get<AppleReceiptValidatorService>(
      AppleReceiptValidatorService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
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
      (monetisationService.handleStripeWebhook as jest.Mock).mockResolvedValue(
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
      (monetisationService.handleAppleWebhook as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.handleAppleWebhook(payload);
      expect(monetisationService.handleAppleWebhook).toHaveBeenCalledWith(
        payload,
      );
      expect(result).toEqual(response);
    });
  });

  describe('handleGoogleWebhook', () => {
    it('should pass webhook payload to service', async () => {
      const payload = { version: '1.0' };
      const response = { received: true, status: 'processed' };
      (monetisationService.handleGoogleWebhook as jest.Mock).mockResolvedValue(
        response,
      );

      const result = await controller.handleGoogleWebhook(payload);
      expect(monetisationService.handleGoogleWebhook).toHaveBeenCalledWith(
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
      (monetisationService.generateApiKey as jest.Mock).mockResolvedValue(
        response,
      );

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
      (
        monetisationService.getDeveloperAnalytics as jest.Mock
      ).mockResolvedValue(response);

      const result = await controller.getAnalytics({ id: 'user-1' } as any);
      expect(monetisationService.getDeveloperAnalytics).toHaveBeenCalledWith(
        'user-1',
      );
      expect(result).toEqual(response);
    });
  });

  describe('getDiagnosticLogs', () => {
    it('should return logs from service', async () => {
      const logs = [{ id: 'log-1', category: 'POSTGIS' }];
      (monetisationService.getDiagnosticLogs as jest.Mock).mockResolvedValue(
        logs,
      );

      const result = await controller.getDiagnosticLogs();
      expect(monetisationService.getDiagnosticLogs).toHaveBeenCalled();
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
      (monetisationService.createDiagnosticLog as jest.Mock).mockResolvedValue(
        log,
      );

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

    it('should call service.createCheckoutSession with correct parameters', async () => {
      const dto = {
        planId: 'consumer_8_ukp_10_usd',
        interval: 'month' as const,
      };
      const mockResponse = {
        sessionUrl: 'https://checkout.stripe.com/session_123',
        sessionId: 'cs_test_abc123',
      };
      (
        monetisationService.createCheckoutSession as jest.Mock
      ).mockResolvedValue(mockResponse);

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

    it('should handle yearly interval', async () => {
      const dto = {
        planId: 'consumer_8_ukp_10_usd',
        interval: 'year' as const,
      };
      const mockResponse = {
        sessionUrl: 'https://checkout.stripe.com/session_456',
        sessionId: 'cs_test_def456',
      };
      (
        monetisationService.createCheckoutSession as jest.Mock
      ).mockResolvedValue(mockResponse);

      const result = await controller.createCheckoutSession(
        { id: 'user-1' } as any,
        dto,
      );

      expect(monetisationService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'consumer_8_ukp_10_usd',
        'year',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should propagate service errors', async () => {
      const dto = { planId: 'invalid_plan', interval: 'month' as const };
      const error = new Error('Plan not found');
      (
        monetisationService.createCheckoutSession as jest.Mock
      ).mockRejectedValue(error);

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
      (
        appleReceiptValidatorService.validateReceipt as jest.Mock
      ).mockResolvedValue(response);

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
});
