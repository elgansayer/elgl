-- Escrow Payments tables for GDPR-compliant milestone-based transactions

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_subject VARCHAR(255) NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'usd',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'funded', 'partially_released', 'completed', 'disputed', 'refunded', 'cancelled')),
  total_milestones INTEGER NOT NULL DEFAULT 1 CHECK (total_milestones > 0),
  released_milestones INTEGER NOT NULL DEFAULT 0 CHECK (released_milestones >= 0),
  stripe_payment_intent_id VARCHAR(255),
  is_data_scrubbed BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_retention_date TIMESTAMPTZ NOT NULL,
  gdpr_scrubbed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escrow_transactions_sender_id ON escrow_transactions(sender_id);
CREATE INDEX idx_escrow_transactions_recipient_id ON escrow_transactions(recipient_id);
CREATE INDEX idx_escrow_transactions_status ON escrow_transactions(status);
CREATE INDEX idx_escrow_transactions_retention ON escrow_transactions(gdpr_retention_date)
  WHERE is_data_scrubbed = FALSE;

CREATE TABLE IF NOT EXISTS escrow_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  milestone_index INTEGER NOT NULL CHECK (milestone_index >= 0),
  title VARCHAR(255) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'released', 'refunded')),
  release_note TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(escrow_id, milestone_index)
);

CREATE INDEX idx_escrow_milestones_escrow_id ON escrow_milestones(escrow_id);

CREATE TABLE IF NOT EXISTS escrow_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrow_transactions(id) ON DELETE CASCADE,
  raised_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved_sender', 'resolved_recipient', 'cancelled')),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_escrow_disputes_escrow_id ON escrow_disputes(escrow_id);
CREATE INDEX idx_escrow_disputes_raised_by ON escrow_disputes(raised_by);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_escrow_updated_at
  BEFORE UPDATE ON escrow_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_escrow_updated_at();