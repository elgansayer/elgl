import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';

describe('SubscriptionPlansService', () => {
  let service: SubscriptionPlansService;

  beforeEach(() => {
    const configuredProducts: Record<string, string> = {
      STRIPE_MONTHLY_PRICE_ID: 'price_live_consumer_monthly',
      STRIPE_YEARLY_PRICE_ID: 'price_live_consumer_yearly',
      STRIPE_PRO_MONTHLY_PRICE_ID: 'price_live_pro_monthly',
      STRIPE_PRO_YEARLY_PRICE_ID: 'price_live_pro_yearly',
      STRIPE_DEVELOPER_MONTHLY_PRICE_ID: 'price_live_developer_monthly',
      STRIPE_DEVELOPER_YEARLY_PRICE_ID: 'price_live_developer_yearly',
    };
    const configService = {
      get: vi.fn((key: string) => configuredProducts[key]),
    } as unknown as ConfigService;

    service = new SubscriptionPlansService(configService);
  });

  it('publishes the Pro plan with the four core product benefits', () => {
    const pro = service.getPlanById('pro_12_ukp_15_usd');

    expect(pro.name).toBe('Pro');
    expect(pro.features).toEqual(
      expect.arrayContaining([
        'Unlimited AI translations',
        'Advanced visitor logs (who viewed your profile)',
        'Nearby members visibility boost',
        'Ad-free experience',
      ]),
    );
  });

  it.each([
    ['pro_12_ukp_15_usd', 'pro'],
    ['price_pro_monthly', 'pro'],
    ['price_pro_yearly', 'pro'],
    ['com.hellotalk.pro.monthly', 'pro'],
    ['com.hellotalk.pro.yearly', 'pro'],
    ['price_live_pro_monthly', 'pro'],
    ['price_live_pro_yearly', 'pro'],
    ['consumer_8_ukp_10_usd', 'consumer'],
    ['com.hellotalk.vip.monthly', 'consumer'],
    ['com.hellotalk.consumer.yearly', 'consumer'],
    ['price_live_consumer_monthly', 'consumer'],
    ['developer_20_ukp_26_usd', 'developer'],
    ['com.hellotalk.developer.monthly', 'developer'],
    ['price_live_developer_yearly', 'developer'],
  ])('maps %s to canonical %s entitlement', (productId, tier) => {
    expect(service.getTierByProductId(productId)).toBe(tier);
  });

  it('does not grant an entitlement for free or unknown products', () => {
    expect(service.getTierByProductId('free')).toBeNull();
    expect(service.getTierByProductId('unknown-product')).toBeNull();
  });

  it('fails clearly when a requested plan does not exist', () => {
    expect(() => service.getPlanById('missing-plan')).toThrow(
      NotFoundException,
    );
  });
});
