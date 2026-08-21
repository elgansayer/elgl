/**
 * Represents a subscription record in the database.
 */
export interface Subscription {
  id: string;
  user_id: string;
  product_id: string;
  status:
    'active' | 'canceled' | 'expired' | 'on_hold' | 'grace_period' | 'revoked';
  auto_renew: boolean;
  renewal_product_id: string | null;
  purchase_token: string | null;
  transaction_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Represents a subscription product configuration.
 */
export interface SubscriptionProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  platform_product_id: {
    ios?: string;
    android?: string;
    web?: string;
  };
}

/**
 * Represents the result of a subscription verification.
 */
export interface VerifiedSubscription {
  valid: boolean;
  productId: string;
  transactionId: string;
  platform: 'ios' | 'android' | 'web';
  expiresAt: string;
  autoRenew: boolean;
}

/**
 * Represents a subscription notification from Apple or Google.
 * The notification payload shape varies by provider; use `unknown`
 * and narrow with provider-specific typed interfaces at the call site.
 */
export interface SubscriptionNotification {
  type: 'apple' | 'google';
  notificationType: string | number;
  subtype?: string;
  data: unknown;
}
