-- Create google_play_purchases table for tracking Google Play Billing subscriptions
CREATE TABLE IF NOT EXISTS google_play_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  purchase_token TEXT UNIQUE NOT NULL,
  subscription_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for looking up purchases by user
CREATE INDEX idx_google_play_purchases_user_id ON google_play_purchases(user_id);

-- Index for finding active purchases
CREATE INDEX idx_google_play_purchases_status ON google_play_purchases(status);
