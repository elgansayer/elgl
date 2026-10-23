import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type VipTier = 'consumer' | 'pro' | 'developer';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_ukp: number;
  price_usd: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  is_popular?: boolean;
  stripe_price_id?: string;
  stripe_price_id_yearly?: string;
  highlighted_benefits?: string[];
  badge_text?: string;
}

@Injectable()
export class SubscriptionPlansService {
  private readonly plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic language exchange features',
      price_ukp: 0,
      price_usd: 0,
      currency: 'USD',
      interval: 'month',
      features: [
        '1 target language',
        'Basic profile with bio',
        'Text chat only',
        '10 AI translations per day',
        'Standard search radius (10km)',
        'Basic moments feed',
        'Standard support',
      ],
      highlighted_benefits: [
        'Start learning immediately',
        'Connect with native speakers',
        'Access global community',
      ],
    },
    {
      id: 'consumer_8_ukp_10_usd',
      name: 'Consumer VIP',
      description: 'Unlock premium features for serious learners',
      price_ukp: 8,
      price_usd: 10,
      currency: 'USD',
      interval: 'month',
      is_popular: true,
      stripe_price_id: 'price_consumer_vip_monthly',
      stripe_price_id_yearly: 'price_consumer_vip_yearly',
      badge_text: 'Most Popular',
      features: [
        'Up to 3 target languages',
        'Unlimited AI translations & corrections',
        'Voice & video messages',
        'Location spoofing (mock location)',
        'Priority in search results',
        'Advanced profile customization',
        'See who viewed your profile',
        'Ad-free experience',
        'Extended moments feed',
        'Premium support',
        'Early access to new features',
      ],
      highlighted_benefits: [
        'Unlimited AI translations & corrections',
        'Mock your location anywhere in the world',
        'Priority visibility in discovery',
        'Voice & video messaging',
        'Ad-free experience',
      ],
    },
    {
      id: 'developer_20_ukp_26_usd',
      name: 'Developer Tier',
      description: 'For power users who want programmatic access',
      price_ukp: 20,
      price_usd: 26,
      currency: 'USD',
      interval: 'month',
      stripe_price_id: 'price_developer_tier_monthly',
      badge_text: 'Power User',
      features: [
        'Everything in Consumer VIP',
        'Developer API key generation',
        '600 API calls per minute rate limit',
        'Developer analytics dashboard',
        'Diagnostic logging access',
        'Webhook integration support',
        'Priority API support',
        'Early access to new features',
        'Custom integrations',
        'Bulk vocabulary export',
      ],
      highlighted_benefits: [
        'Full API access with 600 RPM rate limit',
        'Build integrations on top of HelloTalk',
        'Real-time diagnostic logs & analytics',
        'Priority developer support',
        'Custom integrations',
      ],
    },
    {
      id: 'pro_12_ukp_15_usd',
      name: 'Pro',
      description:
        'Unlimited translations, advanced visitor insights, nearby visibility & ad-free',
      price_ukp: 12,
      price_usd: 15,
      currency: 'USD',
      interval: 'month',
      is_popular: true,
      stripe_price_id: 'price_pro_monthly',
      stripe_price_id_yearly: 'price_pro_yearly',
      badge_text: 'Best Value',
      features: [
        'Unlimited AI translations',
        'Advanced visitor logs (who viewed your profile)',
        'See who has bookmarked you',
        'Nearby members visibility boost',
        'Ad-free experience',
        'Priority community support',
        'Mock your location anywhere (VIP)',
        'Up to 5 target languages',
      ],
      highlighted_benefits: [
        'Unlimited AI translations',
        'See who visited your profile',
        'Boosted visibility in Nearby',
        'Fully ad-free',
        'Up to 5 target languages',
      ],
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  getAllPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlanById(id: string): SubscriptionPlan {
    const plan = this.plans.find((p) => p.id === id);
    if (!plan) {
      throw new NotFoundException(
        `Subscription plan with id "${id}" not found`,
      );
    }
    return plan;
  }

  getHighlightedBenefits(planId: string): string[] {
    const plan = this.getPlanById(planId);
    return plan.highlighted_benefits || [];
  }

  getPopularPlan(): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.is_popular);
  }

  getNonFreePlans(): SubscriptionPlan[] {
    return this.plans.filter((p) => p.id !== 'free');
  }

  getFreePlan(): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.id === 'free');
  }

  getShowcasePlans(): SubscriptionPlan[] {
    return this.plans.map((plan) => ({
      ...plan,
      highlighted_benefits: plan.highlighted_benefits || [],
    }));
  }

  /**
   * Resolve any supported store product or internal plan id to the canonical
   * entitlement value persisted in users.vip_tier. Keeping this value stable
   * matters because authorization and product UI branch on consumer/pro/developer,
   * while individual stores use different product identifiers.
   */
  getTierByProductId(productId: string): VipTier | null {
    const configuredStripeProducts: Array<[string | undefined, VipTier]> = [
      [this.configService.get<string>('STRIPE_MONTHLY_PRICE_ID'), 'consumer'],
      [this.configService.get<string>('STRIPE_YEARLY_PRICE_ID'), 'consumer'],
      [this.configService.get<string>('STRIPE_PRO_MONTHLY_PRICE_ID'), 'pro'],
      [this.configService.get<string>('STRIPE_PRO_YEARLY_PRICE_ID'), 'pro'],
      [
        this.configService.get<string>('STRIPE_DEVELOPER_MONTHLY_PRICE_ID'),
        'developer',
      ],
      [
        this.configService.get<string>('STRIPE_DEVELOPER_YEARLY_PRICE_ID'),
        'developer',
      ],
    ];

    const configuredMatch = configuredStripeProducts.find(
      ([configuredProductId]) =>
        configuredProductId !== undefined && configuredProductId === productId,
    );
    if (configuredMatch) return configuredMatch[1];

    const plan = this.plans.find(
      (candidate) =>
        candidate.stripe_price_id === productId ||
        candidate.stripe_price_id_yearly === productId ||
        candidate.id === productId,
    );
    if (plan) return this.getCanonicalTierForPlanId(plan.id);

    const productTierMap: Record<string, VipTier> = {
      'com.hellotalk.vip.monthly': 'consumer',
      'com.hellotalk.vip.yearly': 'consumer',
      'com.hellotalk.consumer.monthly': 'consumer',
      'com.hellotalk.consumer.yearly': 'consumer',
      'com.hellotalk.pro.monthly': 'pro',
      'com.hellotalk.pro.yearly': 'pro',
      'com.hellotalk.developer.monthly': 'developer',
      'com.hellotalk.developer.yearly': 'developer',
    };

    return productTierMap[productId] ?? null;
  }

  private getCanonicalTierForPlanId(planId: string): VipTier | null {
    if (planId.startsWith('developer_')) return 'developer';
    if (planId.startsWith('pro_')) return 'pro';
    if (planId.startsWith('consumer_')) return 'consumer';
    return null;
  }
}
