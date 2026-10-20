import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MonetisationService } from './monetisation.service';
import { AppleNotificationService } from './apple-notification.service';
import { GooglePlayNotificationService } from './google-play-notification.service';
import { SupabaseService } from '../supabase/supabase.service';
import { SubscriptionPlansService } from './services/subscription-plans.service';
import { AppleReceiptValidatorService } from './apple-receipt-validator.service';

const mockConstructEvent = vi.fn();
const mockCheckoutSessionCreate = vi.fn();
const mockSubscriptionsList = vi.fn();
const mockSubscriptionsUpdate = vi.fn();
const mockInvoicesList = vi.fn();
const mockBillingPortalSessionsCreate = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(function () {
      return {
        webhooks: {
          constructEvent: (...args: any[]) => mockConstructEvent(...args),
        },
        checkout: {
          sessions: {
            create: mockCheckoutSessionCreate,
          },
        },
        subscriptions: {
          list: (...args: any[]) => mockSubscriptionsList(...args),
          update: (...args: any[]) => mockSubscriptionsUpdate(...args),
        },
        invoices: {
          list: (...args: any[]) => mockInvoicesList(...args),
        },
        billingPortal: {
          sessions: {
            create: (...args: any[]) =>
              mockBillingPortalSessionsCreate(...args),
          },
        },
      };
    }),
  };
});

describe('MonetisationService', () => {
  let service: MonetisationService;
  let module: TestingModule;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: 'PinoLogger:MonetisationService',
          useValue: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
          },
        },
        MonetisationService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key) => {
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test';
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test';
              return null;
            }),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: AppleNotificationService,
          useValue: {
            handleNotification: vi.fn(),
          },
        },
        {
          provide: GooglePlayNotificationService,
          useValue: {
            handleNotification: vi.fn(),
          },
        },
        {
          provide: SubscriptionPlansService,
          useValue: {
            getPlanById: vi.fn(),
          },
        },
        {
          provide: AppleReceiptValidatorService,
          useValue: {
            validateReceipt: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MonetisationService>(MonetisationService);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
        vip_tier: 'developer',
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(result).toEqual({ received: true, status: 'processed' });
    });

    it('should upgrade user when customer.subscription.created with metadata', async () => {
      const event: any = {
        type: 'customer.subscription.created',
        data: {
          object: {
            metadata: {
              userId: 'user-2',
              tier: 'consumer',
            },
          },
        },
      };
      mockConstructEvent.mockReturnValue(event);

      const result = await service.handleStripeWebhook(Buffer.from(''), 'sig');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        is_vip: true,
        vip_tier: 'consumer',
      });
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

    it('should verify the signature via stripe.webhooks.constructEvent using the raw body, signature header, and configured webhook secret', async () => {
      const event: any = {
        type: 'unknown.event',
        data: { object: {} },
      };
      mockConstructEvent.mockReturnValue(event);
      const rawBody = Buffer.from('{"id":"evt_123"}');

      await service.handleStripeWebhook(rawBody, 'stripe-signature-header');

      expect(mockConstructEvent).toHaveBeenCalledWith(
        rawBody,
        'stripe-signature-header',
        'whsec_test',
      );
    });

    it('should throw BadRequestException and not mutate VIP status when signature verification fails', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error(
          'No signatures found matching the expected signature for payload',
        );
      });

      await expect(
        service.handleStripeWebhook(Buffer.from('tampered'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should throw an error when STRIPE_WEBHOOK_SECRET is not configured', async () => {
      const configService = module.get<ConfigService>(ConfigService);
      vi.spyOn(configService, 'get').mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? undefined : 'sk_test',
      );

      await expect(
        service.handleStripeWebhook(Buffer.from(''), 'sig'),
      ).rejects.toThrow('STRIPE_WEBHOOK_SECRET is not configured');
      expect(mockConstructEvent).not.toHaveBeenCalled();
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
      // Ensure mockQueryBuilder.single is properly mocked for this test
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'log-1', category: 'REDIS' },
        error: null,
      });
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

    it('should throw ForbiddenException for non-developer tier VIP user', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'user-vip', is_vip: true, vip_tier: 'consumer' },
        error: null,
      });

      await expect(service.generateApiKey('user-vip')).rejects.toThrow(
        new ForbiddenException(
          'Developer API Access is reserved for active subscribers. Upgrade to Developer Tier (20 UKP / $26 USD per month) to generate programmatic API keys!',
        ),
      );
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
    let configService: ConfigService;

    beforeEach(() => {
      configService = module.get<ConfigService>(ConfigService);
      vi.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'STRIPE_MONTHLY_PRICE_ID') return 'price_monthly';
        if (key === 'STRIPE_YEARLY_PRICE_ID') return 'price_yearly';
        if (key === 'FRONTEND_URL') return 'http://localhost:4200';
        return null;
      });
    });

    it('should create a checkout session successfully for monthly plan', async () => {
      const mockSession = {
        url: 'https://checkout.stripe.com/session_123',
        id: 'cs_test_abc123',
      };

      (service as any).stripe.checkout.sessions.create = vi
        .fn()
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession(
        'user-1',
        'consumer_8_ukp_10_usd',
        'month',
      );

      expect(
        (service as any).stripe.checkout.sessions.create,
      ).toHaveBeenCalledWith({
        mode: 'subscription',
        line_items: [{ price: 'price_monthly', quantity: 1 }],
        metadata: {
          userId: 'user-1',
          planId: 'consumer_8_ukp_10_usd',
          interval: 'month',
          tier: 'consumer',
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
      const mockSession = {
        url: 'https://checkout.stripe.com/session_456',
        id: 'cs_test_def456',
      };

      (service as any).stripe.checkout.sessions.create = vi
        .fn()
        .mockResolvedValue(mockSession);

      const result = await service.createCheckoutSession(
        'user-1',
        'consumer_50_ukp_63_usd',
        'year',
      );

      expect(
        (service as any).stripe.checkout.sessions.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: 'price_yearly', quantity: 1 }],
          metadata: {
            userId: 'user-1',
            planId: 'consumer_50_ukp_63_usd',
            interval: 'year',
            tier: 'consumer',
          },
        }),
      );
      expect(result).toEqual({
        sessionUrl: 'https://checkout.stripe.com/session_456',
        sessionId: 'cs_test_def456',
      });
    });

    it('should throw BadRequestException when no Stripe price ID is configured', async () => {
      vi.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'STRIPE_MONTHLY_PRICE_ID') return undefined;
        if (key === 'STRIPE_YEARLY_PRICE_ID') return undefined;
        return null;
      });

      await expect(
        service.createCheckoutSession(
          'user-1',
          'consumer_8_ukp_10_usd',
          'month',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle Stripe API errors gracefully', async () => {
      (service as any).stripe.checkout.sessions.create = vi
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

    it('should use getPriceIdForPlan helper for monthly plan', async () => {
      const mockSession = {
        url: 'https://checkout.stripe.com/session_789',
        id: 'cs_test_ghi789',
      };

      (service as any).stripe.checkout.sessions.create = vi
        .fn()
        .mockResolvedValue(mockSession);

      const getPriceIdSpy = vi.spyOn(service as any, 'getPriceIdForPlan');

      await service.createCheckoutSession(
        'user-1',
        'consumer_8_ukp_10_usd',
        'month',
      );

      expect(getPriceIdSpy).toHaveBeenCalledWith(
        'consumer_8_ukp_10_usd',
        'month',
      );
    });

    it('should use getPriceIdForPlan helper for yearly plan', async () => {
      const mockSession = {
        url: 'https://checkout.stripe.com/session_101',
        id: 'cs_test_jkl101',
      };

      (service as any).stripe.checkout.sessions.create = vi
        .fn()
        .mockResolvedValue(mockSession);

      const getPriceIdSpy = vi.spyOn(service as any, 'getPriceIdForPlan');

      await service.createCheckoutSession(
        'user-1',
        'consumer_50_ukp_63_usd',
        'year',
      );

      expect(getPriceIdSpy).toHaveBeenCalledWith(
        'consumer_50_ukp_63_usd',
        'year',
      );
    });
  });

  describe('getDiagnosticLogs', () => {
    it('should return diagnostic logs when query succeeds', async () => {
      const logs = [{ id: 'log-1', category: 'POSTGIS' }];
      const userCheckChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_vip: true, vip_tier: 'developer' },
          error: null,
        }),
      };
      const logsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: logs,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(userCheckChain)
        .mockReturnValueOnce(logsChain);

      const result = await service.getDiagnosticLogs('user-1');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith(
        'developer_diagnostic_logs',
      );
      expect(result).toEqual(logs);
    });

    it('should return empty array when query fails', async () => {
      const userCheckChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_vip: true, vip_tier: 'developer' },
          error: null,
        }),
      };
      const failingChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'failed' },
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(userCheckChain)
        .mockReturnValueOnce(failingChain);

      const result = await service.getDiagnosticLogs('user-1');
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
      const userCheckChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_vip: true, vip_tier: 'developer' },
          error: null,
        }),
      };
      const insertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: created,
          error: null,
        }),
      };

      mockSupabaseClient.from
        .mockReturnValueOnce(userCheckChain)
        .mockReturnValueOnce(insertChain);

      const result = await service.createDiagnosticLog('user-1', {
        category: 'REDIS',
        status: 'success',
        message: 'done',
      });
      expect(result).toEqual(created);
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should return VIP details with billing info when an active Stripe subscription exists', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { is_vip: true, vip_tier: 'consumer', email: 'user@example.com' },
        error: null,
      });
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            cancel_at_period_end: false,
            customer: 'cus_1',
            items: {
              data: [
                {
                  current_period_end: 1893456000,
                  price: {
                    unit_amount: 800,
                    currency: 'gbp',
                    recurring: { interval: 'month' },
                  },
                },
              ],
            },
          },
        ],
      });

      const result = await service.getSubscriptionDetails('user-1');

      expect(result).toEqual({
        isVip: true,
        vipTier: 'consumer',
        email: 'user@example.com',
        billing: {
          cancelAtPeriodEnd: false,
          currentPeriodEnd: new Date(1893456000 * 1000).toISOString(),
          nextBillingAmount: 8,
          currency: 'gbp',
          interval: 'month',
        },
      });
    });

    it('should return null billing when the user has no active Stripe subscription', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { is_vip: false, vip_tier: null, email: 'free@example.com' },
        error: null,
      });
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      const result = await service.getSubscriptionDetails('user-2');

      expect(result).toEqual({
        isVip: false,
        vipTier: null,
        email: 'free@example.com',
        billing: null,
      });
    });

    it('should throw when the user row cannot be fetched', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });

      await expect(service.getSubscriptionDetails('missing')).rejects.toThrow(
        'Failed to fetch subscription details: not found',
      );
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel the active subscription at period end', async () => {
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            cancel_at_period_end: false,
          },
        ],
      });
      mockSubscriptionsUpdate.mockResolvedValue({});

      const result = await service.cancelSubscription('user-1');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: true,
      });
      expect(result.message).toContain('cancelled at the end');
    });

    it('should throw BadRequestException when no active subscription exists', async () => {
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      await expect(service.cancelSubscription('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a subscription scheduled to cancel', async () => {
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            cancel_at_period_end: true,
          },
        ],
      });
      mockSubscriptionsUpdate.mockResolvedValue({});

      const result = await service.resumeSubscription('user-1');

      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith('sub_1', {
        cancel_at_period_end: false,
      });
      expect(result.message).toContain('resumed');
    });

    it('should throw BadRequestException when no active subscription exists', async () => {
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      await expect(service.resumeSubscription('user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when the subscription is not scheduled to cancel', async () => {
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            cancel_at_period_end: false,
          },
        ],
      });

      await expect(service.resumeSubscription('user-1')).rejects.toThrow(
        'Subscription is not scheduled for cancellation.',
      );
    });
  });

  describe('listInvoices', () => {
    it('should return mapped invoices for a user with an active subscription', async () => {
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            customer: 'cus_1',
          },
        ],
      });
      mockInvoicesList.mockResolvedValue({
        data: [
          {
            id: 'in_1',
            amount_paid: 800,
            currency: 'gbp',
            status: 'paid',
            created: 1893456000,
            invoice_pdf: 'https://stripe.test/invoice.pdf',
            hosted_invoice_url: 'https://stripe.test/invoice',
          },
        ],
      });

      const result = await service.listInvoices('user-1');

      expect(mockInvoicesList).toHaveBeenCalledWith({
        customer: 'cus_1',
        limit: 12,
      });
      expect(result).toEqual([
        {
          id: 'in_1',
          amountPaid: 8,
          currency: 'gbp',
          status: 'paid',
          created: new Date(1893456000 * 1000).toISOString(),
          invoicePdf: 'https://stripe.test/invoice.pdf',
          hostedInvoiceUrl: 'https://stripe.test/invoice',
        },
      ]);
    });

    it('should return an empty array when the user has no active subscription', async () => {
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      const result = await service.listInvoices('user-1');

      expect(result).toEqual([]);
      expect(mockInvoicesList).not.toHaveBeenCalled();
    });
  });

  describe('createBillingPortalSession', () => {
    it('should create a billing portal session for the user Stripe customer', async () => {
      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_1',
            status: 'active',
            metadata: { userId: 'user-1' },
            customer: 'cus_1',
          },
        ],
      });
      mockBillingPortalSessionsCreate.mockResolvedValue({
        url: 'https://billing.stripe.com/session/test',
      });

      const result = await service.createBillingPortalSession('user-1');

      expect(mockBillingPortalSessionsCreate).toHaveBeenCalledWith({
        customer: 'cus_1',
        return_url: expect.stringContaining('/my-subscription'),
      });
      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/test',
      });
    });

    it('should throw BadRequestException when the user has no active subscription', async () => {
      mockSubscriptionsList.mockResolvedValue({ data: [] });

      await expect(
        service.createBillingPortalSession('user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
