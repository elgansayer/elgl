-- Migration: Review RLS policies for Escrow Payments
-- Fixes #2400: Creates the escrows table and adds Row Level Security policies
-- so that a leaked anon/authenticated key or direct Supabase Studio access
-- cannot read or mutate escrow records outside of the participant's scope.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).

-- ── 1. Create the escrows table ──────────────────────────────────────────
-- Column definitions match the EscrowRow interface in
-- backend/src/escrow/interfaces/escrow.interface.ts and the payloads used
-- in EscrowService (backend/src/escrow/escrow.service.ts).

CREATE TABLE IF NOT EXISTS public.escrows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'released', 'refunded', 'disputed', 'cancelled')),
    description TEXT NOT NULL DEFAULT '',
    service_type VARCHAR(30) NOT NULL DEFAULT 'other'
        CHECK (service_type IN ('lesson', 'language_exchange', 'proofreading', 'translation', 'other')),
    dispute_reason TEXT,
    dispute_evidence TEXT,
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS escrows_sender_id_idx ON public.escrows (sender_id);
CREATE INDEX IF NOT EXISTS escrows_receiver_id_idx ON public.escrows (receiver_id);
CREATE INDEX IF NOT EXISTS escrows_status_idx ON public.escrows (status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.escrows;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.escrows
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── 2. Enable RLS ────────────────────────────────────────────────────────

ALTER TABLE public.escrows ENABLE ROW LEVEL SECURITY;

-- ── 3. SELECT: participants + admins ─────────────────────────────────────
-- Both the sender and receiver must be able to view their escrow records.
-- Admins can view all escrows for dispute resolution.

CREATE POLICY escrows_select_participant ON public.escrows
    FOR SELECT TO authenticated USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 4. INSERT: sender must be the authenticated user ─────────────────────
-- Only the sender can create an escrow, and the sender_id must match the
-- authenticated user's ID.

CREATE POLICY escrows_insert_sender ON public.escrows
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = sender_id
        AND sender_id != receiver_id
    );

-- ── 5. UPDATE: participants + admins ─────────────────────────────────────
-- Participants can update escrow status from pending to disputed (dispute
-- flow). Admins can update any escrow (dispute resolution).  The sender
-- releasing/refunding and the receiver disputing are all covered by the
-- participant check; the backend enforces the stricter per-role rules
-- (e.g. only sender can release/refund).

CREATE POLICY escrows_update_participant ON public.escrows
    FOR UPDATE TO authenticated USING (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    ) WITH CHECK (
        auth.uid() = sender_id
        OR auth.uid() = receiver_id
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 6. No DELETE policy ──────────────────────────────────────────────────
-- Escrow records represent financial transactions and must never be deleted
-- by any client.  Deletion (if ever needed) is restricted to the service_role
-- backend only.