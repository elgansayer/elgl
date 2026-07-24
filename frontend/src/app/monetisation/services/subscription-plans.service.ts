import { Injectable } from '@angular/core';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // in GBP
  priceUSD: number; // in USD
  description: string;
  features: string[];
  isPopular?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SubscriptionPlansService {
  private plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      priceUSD: 0,
      description: 'Get started with basic features',
      features: [
        'Up to 1 target language',
        '10 AI calls per day',
        'Basic profile',
        'Community access',
      ],
    },
    {
      id: 'consumer_8_ukp_10_usd',
      name: 'Consumer',
      price: 8,
      priceUSD: 10,
      description: 'Unlock more learning tools',
      features: [
        'Up to 3 target languages',
        'Unlimited AI calls',
        'Advanced profile customization',
        'Priority support',
        'Location spoofing (VIP)',
      ],
      isPopular: true,
    },
    {
      id: 'developer_20_ukp_26_usd',
      name: 'Developer',
      price: 20,
      priceUSD: 26,
      description: 'For power users and developers',
      features: [
        'Everything in Consumer',
        'API access',
        'Custom integrations',
        'Early access to new features',
        'Dedicated support',
      ],
    },
  ];

  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }

  getPlanById(id: string): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.id === id);
  }
}
