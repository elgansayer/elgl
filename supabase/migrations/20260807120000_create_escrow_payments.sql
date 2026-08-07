-- Migration: Create Escrow Payments tables with Row Level Security.
-- Fixes #2400: Task: Review Supabase Row Level Security (RLS) policies for
-- Escrow Payments.
--
-- The NestJS backend is the only client that talks to Supabase (see AGENTS.md
-- "API First" mandate) and it authenticates using the service_role key, which
-- always bypasses RLS. These policies exist as defence-in-depth so that a
-- leaked anon/authenticated key, a future direct-to-Supabase client, or the
-- Supabase Studio table editor cannot read or mutate escrow rows outside of
-- the owning user's scope (OWASP A01: Broken Access Control).

-- ── 1. escrow_transactions ──────────────────────────────────────────────────
-- Payer deposits coins into escrow for a specific service or milestone.
-- Funds are locked until released by mutual agreement, automatic timeout,
-- or admin resolution of a dispute.
-- Status values: pending_held, released, refunded, disputed
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    payee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_held'
        CHECK (status IN ('pending_held', 'released', 'refunded', 'disputed')),
    milestone_description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS escrow_transactions_payer_idx
    ON public.escrow_transactions (payer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS escrow_transactions_payee_idx
    ON public.escrow_transactions (payee_id, status, created_at DESC);

-- ── 2. escrow_disputes ──────────────────────────────────────────────────────
-- When either party raises a dispute, the escrow status moves to 'disputed'
-- and a dispute record is created. Admin or automated logic resolves it.
-- Resolution values: pending, released_to_payee, refunded_to_payer, split
CREATE TABLE IF NOT EXISTS public.escrow_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_transaction_id UUID NOT NULL
        REFERENCES public.escrow_transactions(id) ON DELETE RESTRICT,
    raised_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL DEFAULT '',
    resolution VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (resolution IN ('pending', 'released_to_payee', 'refunded_to_payer', 'split')),
    resolution_notes TEXT NOT NULL DEFAULT '',
    resolved_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS escrow_disputes_transaction_idx
    ON public.escrow_disputes (escrow_transaction_id);
CREATE INDEX IF NOT EXISTS escrow_disputes_status_idx
    ON public.escrow_disputes (resolution, created_at DESC);

-- ── 3. Row Level Security ───────────────────────────────────────────────────

-- escrow_transactions: payer and payee can view their own transactions.
-- Admins can view all escrow transactions. Only service_role can UPDATE
-- (release, refund) or DELETE.  Inserts are service_role-only since the
-- backend must validate balances and business rules before creating an escrow.
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_transactions_select_own ON public.escrow_transactions
    FOR SELECT TO authenticated USING (
        auth.uid() = payer_id
        OR auth.uid() = payee_id
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- Only the service_role (backend) can create escrow transactions to ensure
-- server-side validation of coin balances, milestone description, etc.
CREATE POLICY escrow_transactions_insert_service_role ON public.escrow_transactions
    FOR INSERT TO service_role USING (true) WITH CHECK (true);

-- Only the service_role (backend) can update escrow status (release/refund).
CREATE POLICY escrow_transactions_update_service_role ON public.escrow_transactions
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY escrow_transactions_delete_service_role ON public.escrow_transactions
    FOR DELETE TO service_role USING (true);

-- escrow_disputes: payer, payee, and admins can view disputes for their
-- transactions.  The party involved in the transaction can raise a dispute.
-- Only admin or service_role can resolve (update) a dispute.
ALTER TABLE public.escrow_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_disputes_select_own ON public.escrow_disputes
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions et
            WHERE et.id = escrow_disputes.escrow_transaction_id
              AND (et.payer_id = auth.uid() OR et.payee_id = auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- Only involved parties (payer/payee) can raise a dispute.
CREATE POLICY escrow_disputes_insert_involved ON public.escrow_disputes
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.escrow_transactions et
            WHERE et.id = escrow_disputes.escrow_transaction_id
              AND (et.payer_id = auth.uid() OR et.payee_id = auth.uid())
        )
        -- Verify the raiser is actually the authenticated user
        AND auth.uid() = raised_by_id
    );

-- Only admin or service_role can resolve disputes.
CREATE POLICY escrow_disputes_update_admin ON public.escrow_disputes
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
        OR EXISTS (
            -- service_role bypasses RLS entirely; this clause is for
            -- future admin-authenticated client access
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 4. Documentation comments ───────────────────────────────────────────────
COMMENT ON TABLE public.escrow_transactions IS
    'Escrow payment records. Coins are locked from payer at creation and held until release, refund, or dispute resolution. RLS restricts SELECT to involved parties/admins, INSERT/UPDATE/DELETE to service_role.';
COMMENT ON TABLE public.escrow_disputes IS
    'Disputes raised against escrow transactions. RLS restricts SELECT to involved parties/admins, INSERT to involved parties, UPDATE to admins, DELETE to service_role.';