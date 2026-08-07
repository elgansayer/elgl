-- Migration: create escrow_payments table
-- Escrow payments hold coins in trust between two users until resolved.

CREATE TABLE IF NOT EXISTS public.escrow_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payee_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_coins    INTEGER NOT NULL CHECK (amount_coins > 0),
  status          TEXT NOT NULL DEFAULT 'held'
                    CHECK (status IN ('pending','held','released','refunded','cancelled','disputed')),
  reference_type  TEXT NOT NULL,
  reference_id    TEXT NOT NULL,
  held_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL,
  released_at     TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  dispute_reason  TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_escrow_payments_payer_id ON public.escrow_payments(payer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_payee_id ON public.escrow_payments(payee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_status ON public.escrow_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_payments_expires_at ON public.escrow_payments(expires_at) WHERE status = 'held';

-- Trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION public.update_escrow_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_escrow_payments_updated_at ON public.escrow_payments;
CREATE TRIGGER trg_escrow_payments_updated_at
  BEFORE UPDATE ON public.escrow_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_escrow_payments_updated_at();