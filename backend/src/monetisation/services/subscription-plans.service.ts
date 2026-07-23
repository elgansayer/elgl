import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '../interfaces/subscription-plan.interface';

@Injectable()
export class SubscriptionPlansService {
  private readonly plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic features',
      price_ukp: 0,
      price_usd: 0,
      currency: 'USD',
      interval: 'month',
      features: [
        '1 target language',
        'Basic profile',
        '10 AI translations per day',
        'Standard search radius',
        'Basic moments feed',
      ],
      highlighted_benefits: [],
    },
    {
      id: 'consumer_8_ukp_10_usd',
      name: 'VIP Consumer',
      description: 'Unlock premium language learning features',
      price_ukp: 8,
      price_usd: 10,
      currency: 'USD',
      interval: 'month',
      is_popular: true,
      features: [
        'Up to 3 target languages',
        'Unlimited AI translations & corrections',
        'Location spoofing (appear anywhere)',
        'Extended search radius (global)',
        'Priority in discovery algorithm',
        'Ad-free experience',
        'Advanced profile customization',
        'Unlimited voice notes',
        'Priority customer support',
        'Early access to new features',
      ],
      highlighted_benefits: [
        'Unlimited AI translations',
        'Location spoofing',
        'Global discovery',
        'Ad-free',
      ],
      stripe_price_id: 'price_vip_consumer_monthly',
    },
    {
      id: 'developer_20_ukp_26_usd',
      name: 'VIP Developer',
      description: 'For serious language learners and power users',
      price_ukp: 20,
      price_usd: 26,
      currency: 'USD',
      interval: 'month',
      features: [
        'Everything in VIP Consumer',
        'API access for custom integrations',
        'Advanced analytics dashboard',
        'Custom study streak goals',
        'Priority feature requests',
        'Beta program access',
        'Dedicated account manager',
        'Custom pronunciation scoring models',
        'Bulk export of vocabulary & flashcards',
        'White-label profile options',
      ],
      highlighted_benefits: [
        'API access',
        'Advanced analytics',
        'Custom integrations',
        'Priority support',
      ],
      stripe_price_id: 'price_vip_developer_monthly',
    },
  ];

  async findAll(): Promise<SubscriptionPlan[]> {
    return this.plans;
  }

  async findById(id: string): Promise<SubscriptionPlan | undefined> {
    return this.plans.find(plan => plan.id === id);
  }

  async getHighlightedBenefits(planId: string): Promise<string[]> {
    const plan = await this.findById(planId);
    return plan?.highlighted_benefits || [];
  }
}
