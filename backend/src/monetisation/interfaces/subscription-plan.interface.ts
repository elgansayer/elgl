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
}
