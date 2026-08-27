-- Create subscriptions table for Apple App Store subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  original_transaction_id TEXT NOT NULL,
  transaction_id TEXT,
  purchase_date TIMESTAMPTZ,
  expires_date TIMESTAMPTZ,
  environment TEXT DEFAULT 'Sandbox',
  is_active BOOLEAN DEFAULT false,
  is_in_grace_period BOOLEAN DEFAULT false,
  is_refunded BOOLEAN DEFAULT false,
  is_revoked BOOLEAN DEFAULT false,
  auto_renew_status BOOLEAN DEFAULT true,
  auto_renew_product_id TEXT,
  expiration_reason TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one active subscription per user per product
  UNIQUE(user_id, original_transaction_id)
);

-- Index for looking up subscriptions by original transaction ID
CREATE INDEX idx_subscriptions_original_transaction_id 
  ON subscriptions(original_transaction_id);

-- Index for finding active subscriptions
CREATE INDEX idx_subscriptions_user_active 
  ON subscriptions(user_id, is_active) 
  WHERE is_active = true;

-- Create subscription_events table for audit logging
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  product_id TEXT,
  original_transaction_id TEXT,
  notification_type TEXT,
  notification_subtype TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying events by user
CREATE INDEX idx_subscription_events_user 
  ON subscription_events(user_id, created_at DESC);
