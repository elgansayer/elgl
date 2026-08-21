-- Create apple_subscriptions table for tracking App Store purchases
CREATE TABLE IF NOT EXISTS apple_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_transaction_id TEXT UNIQUE NOT NULL,
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'Production',
  purchase_date TIMESTAMPTZ NOT NULL,
  expires_date TIMESTAMPTZ,
  auto_renew_status BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_in_billing_retry BOOLEAN DEFAULT false,
  is_refunded BOOLEAN DEFAULT false,
  refund_date TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT false,
  revoked_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_apple_subscriptions_user_id ON apple_subscriptions(user_id);
CREATE INDEX idx_apple_subscriptions_original_transaction_id ON apple_subscriptions(original_transaction_id);
CREATE INDEX idx_apple_subscriptions_is_active ON apple_subscriptions(is_active);
CREATE INDEX idx_apple_subscriptions_expires_date ON apple_subscriptions(expires_date);
