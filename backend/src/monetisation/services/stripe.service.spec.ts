import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StripeService } from './stripe.service';

describe('StripeService invoice webhooks', () => {
  const retrieveSubscription = vi.fn();
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
  };
  let service: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    const configService = {
      get: vi.fn().mockReturnValue('sk_test_123'),
    };

    service = new StripeService(
      logger as never,
      configService as never,
      {} as never,
      {} as never,
    );
    (
      service as unknown as {
        stripe: {
          subscriptions: {
            retrieve: typeof retrieveSubscription;
          };
        };
      }
    ).stripe = {
      subscriptions: {
        retrieve: retrieveSubscription,
      },
    };
    retrieveSubscription.mockResolvedValue({
      metadata: { userId: 'user-123' },
    });
  });

  it('reads subscription IDs from current invoice parents', async () => {
    const event = {
      data: {
        object: {
          parent: {
            subscription_details: {
              subscription: 'sub_current',
            },
          },
        },
      },
    } as unknown as Stripe.Event;

    await service.handleInvoicePaymentSucceeded(event);

    expect(retrieveSubscription).toHaveBeenCalledWith('sub_current');
    expect(logger.info).toHaveBeenCalledWith(
      'Payment succeeded for user user-123, subscription sub_current',
    );
  });

  it('continues to accept legacy-version invoice payloads', async () => {
    const event = {
      data: {
        object: {
          subscription: { id: 'sub_legacy' },
        },
      },
    } as unknown as Stripe.Event;

    await service.handleInvoicePaymentFailed(event);

    expect(retrieveSubscription).toHaveBeenCalledWith('sub_legacy');
    expect(logger.warn).toHaveBeenCalledWith(
      'Payment failed for user user-123, subscription sub_legacy',
    );
  });

  it('ignores one-off invoices without a subscription', async () => {
    const event = {
      data: {
        object: {
          parent: null,
        },
      },
    } as unknown as Stripe.Event;

    await service.handleInvoicePaymentSucceeded(event);

    expect(retrieveSubscription).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
