-- Create escrow_payments table with status tracking and crash reporting support
CREATE TABLE IF NOT EXISTS public.escrow_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_a_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  party_b_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'coins',
  status TEXT NOT NULL DEFAULT 'awaiting_deposit'
    CHECK (status IN ('awaiting_deposit', 'funds_held', 'disputed', 'released', 'refunded', 'cancelled')),
  description TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  dispute_reason TEXT,
  dispute_opened_at TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('release_to_party_b', 'refund_to_party_a')),
  admin_notes TEXT,
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookups by participants and status
CREATE INDEX IF NOT EXISTS idx_escrow_payments_party_a ON public.escrow_payments(party_a_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_party_b ON public.escrow_payments(party_b_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_status ON public.escrow_payments(status);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_created_at ON public.escrow_payments(created_at DESC);

-- RLS policies
ALTER TABLE public.escrow_payments ENABLE ROW LEVEL SECURITY;

-- Users can view escrows they are party to
CREATE POLICY "Users can view own escrows"
  ON public.escrow_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = party_a_id OR auth.uid() = party_b_id);

-- Users can insert escrows where they are party_a
CREATE POLICY "Users can create escrows"
  ON public.escrow_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = party_a_id);

-- Users can update escrows they are party to (constrained by status transitions in application logic)
CREATE POLICY "Users can update own escrows"
  ON public.escrow_payments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = party_a_id OR auth.uid() = party_b_id);

-- Service role bypass for admin operations
CREATE POLICY "Service role can manage all escrows"
  ON public.escrow_payments
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Escrow audit log table for tracking all state transitions
CREATE TABLE IF NOT EXISTS public.escrow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES public.escrow_payments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  actor_id UUID REFERENCES public.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_escrow_id ON public.escrow_audit_log(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_audit_log_created_at ON public.escrow_audit_log(created_at DESC);

ALTER TABLE public.escrow_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audit log for own escrows"
  ON public.escrow_audit_log
  FOR SELECT
  TO authenticated
  USING (
    escrow_id IN (
      SELECT id FROM public.escrow_payments
      WHERE party_a_id = auth.uid() OR party_b_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage audit logs"
  ON public.escrow_audit_log
  TO service_role
  USING (true)
  WITH CHECK (true);