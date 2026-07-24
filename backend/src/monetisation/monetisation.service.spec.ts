import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonetisationService } from './monetisation.service';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';

const mockConstructEvent = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('MonetisationService', () => {
  let service: MonetisationService;
  let plansService: SubscriptionPlansService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient = {
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonetisationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test';
              return null;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: AppleNotificationService,
          useValue: {
            handleNotification: jest.fn(),
          },
        },
        {
          provide: GooglePlayNotificationService,
          useValue: {
            handleNotification: jest.fn(),
          },
        },
        {
          provide: SubscriptionPlansService,
          useValue: {
            getPlanById: jest.fn(),
          },
        },
        {
          provide: AppleReceiptValidatorService,
          useValue: {
            validateReceipt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MonetisationService>(MonetisationService);
    plansService = module.get<SubscriptionPlansService>(SubscriptionPlansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleStripeWebhook', () => {
    beforeEach(() => {
      mockConstructEvent.mockReset();
    });

    it('should upgrade user when checkout.session.completed with userId and tier', async () => {
      const event: any = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: {
              userId: 'user-1',
              tier: 'developer',
            },
          },
        },
      };
      mockConstructEvent.mockReturnValue(event);

      const result = await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: true,
        vip_tier: 'consumer_8_ukp_10_usd',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ received: true, status: 'processed' });
    });

    it('should revoke VIP status when customer.subscription.deleted', async () => {
      const event: any = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            metadata: {
              userId: 'user-1',
            },
          },
        },
      };
      mockConstructEvent.mockReturnValue(event);

      const result = await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: false,
        vip_tier: null,
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ received: true, status: 'processed' });
    });

    it('should acknowledge webhook when event type is unrecognized or metadata missing', async () => {
      const event: any = {
        type: 'unknown.event',
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(event);

      const result = await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true, status: 'processed' });
    });
  });

  describe('generateApiKey', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.generateApiKey('unknown-id')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should throw ForbiddenException when non-VIP tries to generate API key (verifying dual currency format)', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-free', is_vip: false },
        error: null,
      });

      await expect(service.generateApiKey('user-free')).rejects.toThrow(
        new ForbiddenException(
          'Developer API Access is reserved for active subscribers. Upgrade to Developer Tier (20 UKP / $26 USD per month) to generate programmatic API keys!',
        ),
      );
    });

    it('should generate API key and return developer rate limits for developer tier user', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-dev', is_vip: true, vip_tier: 'developer' },
        error: null,
      });

      const result = await service.generateApiKey('user-dev');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        developer_api_key: expect.stringMatching(/^ht_dev_[a-f0-9]{32}$/),
      });
      expect(result).toEqual({
        api_key: expect.stringMatching(/^ht_dev_[a-f0-9]{32}$/),
        tier: 'developer',
        rate_limit_rpm: 600,
      });
    });

    it('should generate API key and return consumer rate limits for non-developer tier VIP user', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-vip', is_vip: true, vip_tier: 'consumer' },
        error: null,
      });

      const result = await service.generateApiKey('user-vip');

      expect(result).toEqual({
        api_key: expect.stringMatching(/^ht_dev_[a-f0-9]{32}$/),
        tier: 'consumer',
        rate_limit_rpm: 60,
      });
    });
  });

  describe('getDeveloperAnalytics', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(service.getDeveloperAnalytics('unknown')).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should return analytics with dual currency pricing info for developer user', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'user-dev',
            is_vip: true,
            vip_tier: 'developer',
            developer_api_key: 'ht_dev_existingkey',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            user_id: 'user-dev',
            total_api_calls_today: 1420,
            avg_latency_ms: 18,
          },
          error: null,
        });

      const result = await service.getDeveloperAnalytics('user-dev');

      expect(result).toEqual({
        api_key: 'ht_dev_existingkey',
        tier: 'developer',
        total_api_calls_today: 1420,
        avg_latency_ms: 18,
        pricing_info:
          'Developer Tier: 20 UKP / $26 USD per month | Consumer VIP: 8 UKP / $10 USD per month',
      });
    });

    it('should return free tier info when user is not VIP', async () => {
      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'user-free',
            is_vip: false,
            vip_tier: null,
            developer_api_key: null,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      const result = await service.getDeveloperAnalytics('user-free');

      expect(result.tier).toBe('free');
      expect(result.total_api_calls_today).toBe(0);
      expect(result.api_key).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session successfully for monthly plan', async () => {
      const mockPlan = {
        id: 'consumer_8_ukp_10_usd',
        name: 'Consumer VIP',
        stripe_price_id: 'price_consumer_vip_monthly',
        stripe_price_id_yearly: 'price_consumer_vip_yearly',
      };

      const mockSession = {
        url: 'https://checkout.stripe.com/session_123',
        id: 'cs_test_abc123',
      };

      (plansService.getPlanById as jest.Mock).mockReturnValue(mockPlan);

      (service as any).stripe.checkout.sessions.create = jest
        .fn()
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession(
        'user-1',
        'consumer_8_ukp_10_usd',
        'month',
      );

      expect(plansService.getPlanById).toHaveBeenCalledWith(
        'consumer_8_ukp_10_usd',
      );
      expect(
        (service as any).stripe.checkout.sessions.create,
      ).toHaveBeenCalledWith({
        mode: 'subscription',
        line_items: [{ price: 'price_consumer_vip_monthly', quantity: 1 }],
        metadata: {
          userId: 'user-1',
          planId: 'consumer_8_ukp_10_usd',
          interval: 'month',
        },
        success_url: expect.stringContaining('/subscription/success'),
        cancel_url: expect.stringContaining('/subscription/cancel'),
      });
      expect(result).toEqual({
        sessionUrl: 'https://checkout.stripe.com/session_123',
        sessionId: 'cs_test_abc123',
      });
    });

    it('should create a checkout session with yearly price ID when interval is year', async () => {
      const mockPlan = {
        id: 'consumer_8_ukp_10_usd',
        name: 'Consumer VIP',
        stripe_price_id: 'price_consumer_vip_monthly',
        stripe_price_id_yearly: 'price_consumer_vip_yearly',
      };

      const mockSession = {
        url: 'https://checkout.stripe.com/session_456',
        id: 'cs_test_def456',
      };

      (plansService.getPlanById as jest.Mock).mockReturnValue(mockPlan);
      (service as any).stripe.checkout.sessions.create = jest
        .fn()
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession(
        'user-1',
        'consumer_8_ukp_10_usd',
        'year',
      );

      expect(
        (service as any).stripe.checkout.sessions.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_consumer_vip_yearly', quantity: 1 }],
          metadata: {
            userId: 'user-1',
            planId: 'consumer_8_ukp_10_usd',
            interval: 'year',
          },
        }),
      );
      expect(result).toEqual({
        sessionUrl: 'https://checkout.stripe.com/session_456',
        sessionId: 'cs_test_def456',
      });
    });

  it('should throw NotFoundException when plan does not exist', async () => {
      (plansService.getPlanById as jest.Mock).mockImplementation(() => {
        throw new NotFoundException(
          'Subscription plan with id "invalid_plan" not found',
        );
      });

      await expect(
        service.createCheckoutSession('user-1', 'invalid_plan', 'month'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no Stripe price ID is configured', async () => {
      const mockPlan = {
        id: 'free',
        name: 'Free',
        stripe_price_id: undefined,
        stripe_price_id_yearly: undefined,
      };

      (plansService.getPlanById as jest.Mock).mockReturnValue(mockPlan);

      await expect(
        service.createCheckoutSession('user-1', 'free', 'month'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle Stripe API errors gracefully', async () => {
      const mockPlan = {
        id: 'consumer_8_ukp_10_usd',
        name: 'Consumer VIP',
        stripe_price_id: 'price_consumer_vip_monthly',
      };

      (plansService.getPlanById as jest.Mock).mockReturnValue(mockPlan);
      (service as any).stripe.checkout.sessions.create = jest
        .fn()
        .mockRejectedValue(new Error('Stripe API error'));

      await expect(
        service.createCheckoutSession(
          'user-1',
          'consumer_8_ukp_10_usd',
          'month',
        ),
      ).rejects.toThrow('Stripe API error');
    });
  });

  describe('getDiagnosticLogs', () => {
    it('should return diagnostic logs when query succeeds', async () => {
      const logs = [{ id: 'log-1', category: 'POSTGIS' }];
      mockQueryBuilder.limit.mockResolvedValue({
        data: logs,
        error: null,
      });

      const result = await service.getDiagnosticLogs();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'developer_diagnostic_logs',
      );
      expect(result).toEqual(logs);
    });

    it('should return empty array when query fails', async () => {
      mockQueryBuilder.limit.mockResolvedValue({
        data: null,
        error: { message: 'failed' },
      });
      const result = await service.getDiagnosticLogs();
      expect(result).toEqual([]);
    });
  });

  describe('createDiagnosticLog', () => {
    it('should create and return a diagnostic log', async () => {
      const created = {
        id: 'log-1',
        user_id: 'user-1',
        category: 'REDIS',
        status: 'success',
        message: 'done',
        created_at: '2026-01-01T00:00:00.000Z',
      };
      mockQueryBuilder.single.mockResolvedValue({
        data: created,
        error: null,
      });

      const result = await service.createDiagnosticLog('user-1', {
        category: 'REDIS',
        status: 'success',
        message: 'done',
      });
      expect(result).toEqual(created);
    });
  });
});
