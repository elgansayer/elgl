-- Create coin_transactions table for tracking all coin economy activity
-- (daily check-in rewards, purchases, gift sending, sticker pack unlocks)
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT NULL,
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coin_transactions_user_created_idx
    ON public.coin_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coin_transactions_type_idx
    ON public.coin_transactions (type);

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own coin transactions
DROP POLICY IF EXISTS coin_transactions_select_own ON public.coin_transactions;
CREATE POLICY coin_transactions_select_own ON public.coin_transactions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role bypasses RLS for inserts
