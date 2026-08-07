-- Create escrows table for Escrow Payments feature (#2396)
-- Supports payment holds between sender and recipient with full lifecycle tracking

CREATE TABLE IF NOT EXISTS escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'lesson_payment'
    CHECK (type IN ('lesson_payment', 'service_payment', 'product_payment', 'deposit')),
  status VARCHAR(20) NOT NULL DEFAULT 'held'
    CHECK (status IN ('pending', 'held', 'released', 'refunded', 'disputed', 'cancelled')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0 AND amount <= 1000000),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  description VARCHAR(500),
  memo VARCHAR(255),
  reason VARCHAR(500),
  refund_percentage INTEGER CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  admin_note VARCHAR(500),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  disputed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for memory-efficient queries
CREATE INDEX idx_escrows_sender_id ON escrows(sender_id);
CREATE INDEX idx_escrows_recipient_id ON escrows(recipient_id);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_type ON escrows(type);
CREATE INDEX idx_escrows_sender_status ON escrows(sender_id, status);
CREATE INDEX idx_escrows_expires_at ON escrows(expires_at) WHERE status = 'held';

-- RLS policy placeholder: enable RLS but allow authenticated access initially
-- Full RLS review will be done in #2400
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view own escrows"
  ON escrows FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Senders can create escrows"
  ON escrows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Participants can update own escrows"
  ON escrows FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);