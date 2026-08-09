-- Create escrow_transactions table for holding coins in escrow between users
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ
);

-- Index for looking up escrows by payer
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payer
  ON escrow_transactions(payer_id, status, created_at DESC);

-- Index for looking up escrows by payee
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payee
  ON escrow_transactions(payee_id, status, created_at DESC);

-- Index for filtering by status (e.g., finding all held escrows)
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_status
  ON escrow_transactions(status, created_at DESC);