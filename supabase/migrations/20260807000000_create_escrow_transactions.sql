-- Create escrow_transactions table for holding funds between users
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    payee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'held', 'released', 'refunded', 'cancelled', 'failed')),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    held_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS escrow_transactions_payer_id_idx
    ON public.escrow_transactions (payer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS escrow_transactions_payee_id_idx
    ON public.escrow_transactions (payee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS escrow_transactions_status_idx
    ON public.escrow_transactions (status);
CREATE INDEX IF NOT EXISTS escrow_transactions_next_retry_idx
    ON public.escrow_transactions (next_retry_at)
    WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_escrow_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_escrow_transactions_updated_at ON public.escrow_transactions;
CREATE TRIGGER update_escrow_transactions_updated_at
    BEFORE UPDATE ON public.escrow_transactions
    FOR EACH ROW EXECUTE FUNCTION public.update_escrow_updated_at_column();

-- RLS: Users can only see escrow transactions they are involved in
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Users can view their own escrow transactions"
    ON public.escrow_transactions
    FOR SELECT
    USING (auth.uid() = payer_id OR auth.uid() = payee_id);

DROP POLICY IF EXISTS "Users can create escrow transactions as payer" ON public.escrow_transactions;
CREATE POLICY "Users can create escrow transactions as payer"
    ON public.escrow_transactions
    FOR INSERT
    WITH CHECK (auth.uid() = payer_id);

DROP POLICY IF EXISTS "Users can update escrow status" ON public.escrow_transactions;
CREATE POLICY "Users can update escrow status"
    ON public.escrow_transactions
    FOR UPDATE
    USING (auth.uid() = payer_id OR auth.uid() = payee_id);