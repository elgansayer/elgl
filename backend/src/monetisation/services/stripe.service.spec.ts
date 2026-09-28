import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Stripe from 'stripe';
import { MonetisationService } from '../monetisation.service';
import { StripeService } from './stripe.service';
import { SubscriptionPlansService } from './subscription-plans.service';

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {};
  }),
}));

describe('StripeService', () => {
  async function createService(
    nodeEnv: string,
    secretKey: string | undefined,
  ): Promise<StripeService> {
    const module = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: 'PinoLogger:StripeService',
          useValue: { error: vi.fn(), info: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              if (key === 'NODE_ENV') return nodeEnv;
              if (key === 'STRIPE_SECRET_KEY') return secretKey;
              return undefined;
            }),
          },
        },
        { provide: SubscriptionPlansService, useValue: {} },
        { provide: MonetisationService, useValue: {} },
      ],
    }).compile();

    return module.get(StripeService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, 'sk_test', 'sk_test_123', ' SK_TEST_example '])(
    'rejects the production Stripe secret %s',
    async (secretKey) => {
      await expect(createService('production', secretKey)).rejects.toThrow(
        'STRIPE_SECRET_KEY must be configured securely in production',
      );
      expect(Stripe).not.toHaveBeenCalled();
    },
  );

  it('initialises Stripe with a live key in production', async () => {
    await expect(
      createService('production', 'sk_live_example'),
    ).resolves.toBeInstanceOf(StripeService);
    expect(Stripe).toHaveBeenCalledWith('sk_live_example', {
      apiVersion: '2023-10-16',
    });
  });

  it('retains the development fallback key', async () => {
    await expect(
      createService('development', undefined),
    ).resolves.toBeInstanceOf(StripeService);
    expect(Stripe).toHaveBeenCalledWith('sk_test_123', {
      apiVersion: '2023-10-16',
    });
  });
});
