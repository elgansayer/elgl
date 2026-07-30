import { Injectable, NotFoundException } from '@nestjs/common';

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
        'Ad‑free experience',
        'Priority community support',
        'Mock your location anywhere (VIP)',
        'Up to 5 target languages',
      ],
      highlighted_benefits: [
        'Unlimited AI translations',
        'See who visited your profile',
        'Boosted visibility in Nearby',
        'Fully ad‑free',
        'Up to 5 target languages',
      ],
    },
  ];

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

  getTierByProductId(productId: string): string | null {
    const plan = this.plans.find(
      (p) =>
        p.stripe_price_id === productId ||
        p.stripe_price_id_yearly === productId ||
        p.id === productId, // if apple product id is same as tier
    );
    if (plan) return plan.id;

    // Apple specific fallback mapping (as seen in PRODUCT_TIER_MAP)
    const PRODUCT_TIER_MAP: Record<string, string> = {
      'com.hellotalk.vip.monthly': 'consumer_8_ukp_10_usd',
      'com.hellotalk.vip.yearly': 'consumer_8_ukp_10_usd',
      'com.hellotalk.developer.monthly': 'developer_20_ukp_26_usd',
      'com.hellotalk.developer.yearly': 'developer_20_ukp_26_usd',
      'com.hellotalk.pro.monthly': 'pro_12_ukp_15_usd',
      'com.hellotalk.pro.yearly': 'pro_12_ukp_15_usd',
    };
    return PRODUCT_TIER_MAP[productId] || null;
  }
}
