-- Optimise escrow_transactions indices for query performance.
--
-- The existing indices (idx_escrow_transactions_payer, idx_escrow_transactions_payee,
-- idx_escrow_transactions_status) cover common lookup patterns, but several
-- high-frequency query patterns are still missing coverage:
--
--   1. Scheduled job scanning for stale held escrows (expires_at column needed)
--   2. Lookups by reference_id for idempotent payment references
--   3. Optimised index covering the OR query pattern used in listEscrows
--   4. Dedicated created_at-only index for sorted list queries without status filter

-- Add expires_at if not already present (needed for auto-expiry scanning)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'escrow_transactions' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.escrow_transactions
      ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Partial index for scheduled expiration scanning: only held escrows
-- that have an expiry date set. This keeps the index tiny and fast
-- for the background job that processes expired escrows.
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_expires
  ON public.escrow_transactions (expires_at, payer_id)
  WHERE status = 'held' AND expires_at IS NOT NULL;

-- Index on reference_id for fast idempotency checks (e.g., preventing
-- duplicate escrow creation from the same payment reference).
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_reference_id
  ON public.escrow_transactions (reference_id)
  WHERE reference_id IS NOT NULL;

-- Dedicated created_at index for listEscrows when no status filter is
-- applied -- the OR query (payer_id OR payee_id) benefits from the
-- composite status indices, but ORDER BY created_at DESC on its own
-- still needs a sort node without this index.
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_created_at
  ON public.escrow_transactions (created_at DESC);

-- Composite index for listing escrows by payee status only (without created_at sort),
-- used when the frontend filters a specific status for the payee role
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payee_status
  ON public.escrow_transactions (payee_id, status);

-- Composite index for listing escrows by payer status only (without created_at sort)
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_payer_status
  ON public.escrow_transactions (payer_id, status);

-- B-tree index on released_at for audit/reporting queries that
-- aggregate escrow releases by time period
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_released_at
  ON public.escrow_transactions (released_at)
  WHERE released_at IS NOT NULL;

-- B-tree index on refunded_at for audit/reporting queries
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_refunded_at
  ON public.escrow_transactions (refunded_at)
  WHERE refunded_at IS NOT NULL;

-- Enable row-level security on escrow_transactions (the table was
-- created without RLS in the original migration)
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

-- Only the backend service_role writes; authenticated users may read
-- their own escrows for a client-side escrow dashboard.
CREATE POLICY escrow_transactions_service_role ON public.escrow_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY escrow_transactions_select_own ON public.escrow_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id);