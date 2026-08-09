-- Create coin_purchases table for audit logging
CREATE TABLE IF NOT EXISTS coin_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  coins_added INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  receipt_token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for looking up purchases by user
CREATE INDEX IF NOT EXISTS idx_coin_purchases_user_id ON coin_purchases(user_id);

-- Index for looking up purchases by receipt (prevents reuse)
CREATE INDEX IF NOT EXISTS idx_coin_purchases_receipt_token ON coin_purchases(receipt_token);

-- Enable Row Level Security
ALTER TABLE coin_purchases ENABLE ROW LEVEL SECURITY;

-- Only the service role can insert/select
CREATE POLICY "Service role can manage coin_purchases"
  ON coin_purchases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
