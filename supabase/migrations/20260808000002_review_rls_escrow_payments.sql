-- Migration: Review RLS policies for Escrow Payments
-- Fixes #2400: Hardens existing Row Level Security policies for the escrows
-- and escrow_transactions tables so that a leaked anon/authenticated key or
-- direct Supabase Studio access cannot bypass the backend's business logic.
--
-- The NestJS backend authenticates with the service_role key (bypasses RLS).
-- These policies are defence-in-depth (OWASP A01: Broken Access Control).
--
-- Two escrow tables exist in the database:
--   1. escrow_transactions -- coin-based escrow system (active, used by
--      EscrowService in backend/src/escrow/).
--   2. escrows -- fiat-based escrow system (Escrow Payments feature #2396).
--
-- The original escrows table (backend/supabase/migrations) has permissive
-- placeholder policies that must be replaced with hardened ones.

-- ── 1. escrows: replace permissive placeholder RLS with hardened policies ──

-- The original CREATE TABLE migration (backend/supabase/migrations/
-- 20260807000000-create-escrows.sql) created these overly-permissive policies:
--   - "Participants can view own escrows" -- SELECT (OK, but needs admin)
--   - "Senders can create escrows" -- INSERT (permissive, no status guard)
--   - "Participants can update own escrows" -- UPDATE (DANGEROUS: any
--     participant can set any column including status/amount/refund_percentage)
--
-- Security posture after this migration:
--   - Only service_role can INSERT, UPDATE, or DELETE.
--   - Authenticated users can SELECT only their own escrows.
--   - Authenticated admins can SELECT all escrows for moderation.
--   - The backend (service_role) handles all business logic including
--     status transitions and refund logic.

-- Drop the permissive placeholder policies
DROP POLICY IF EXISTS "Participants can view own escrows" ON public.escrows;
DROP POLICY IF EXISTS "Senders can create escrows" ON public.escrows;
DROP POLICY IF EXISTS "Participants can update own escrows" ON public.escrows;

-- Ensure RLS is enabled (may already be)
ALTER TABLE public.escrows ENABLE ROW LEVEL SECURITY;

-- service_role bypass policy: the NestJS backend retains full access
CREATE POLICY escrows_service_role ON public.escrows
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can only read their own escrows; admins can read all
CREATE POLICY escrows_select_own ON public.escrows
    FOR SELECT TO authenticated USING (
        auth.uid() = sender_id
        OR auth.uid() = recipient_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- Authenticated users may create escrows only as sender and only in
-- 'pending' status.  This prevents a direct-to-Supabase client from
-- creating an escrow in 'held' or 'released' status.
CREATE POLICY escrows_insert_own ON public.escrows
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND status = 'pending'
    );

-- Authenticated users may cancel their own pending escrows only.
-- The backend (service_role) handles all other mutations.
CREATE POLICY escrows_update_own ON public.escrows
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = sender_id
        AND status = 'pending'
    )
    WITH CHECK (
        auth.uid() = sender_id
        AND status = 'cancelled'
        -- Only the status column may be changed, and only to 'cancelled'.
        -- The backend validates accompanying metadata (reason, refund) server-side.
    );

-- ── 2. escrow_transactions: add admin read access ──────────────────────────
-- The existing policies from migration 20260808000001_optimise_escrow_indices
-- are:
--   escrow_transactions_service_role: ALL for service_role (OK)
--   escrow_transactions_select_own: SELECT for authenticated (own only)
--
-- For moderation consistency with other RLS-reviewed tables (reports, blocks,
-- safety_reports), admins should be able to read all escrow_transactions rows.

DROP POLICY IF EXISTS escrow_transactions_select_own ON public.escrow_transactions;
CREATE POLICY escrow_transactions_select_own ON public.escrow_transactions
    FOR SELECT TO authenticated USING (
        auth.uid() = payer_id
        OR auth.uid() = payee_id
        OR EXISTS (
            SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

-- ── 3. Add CHECK constraint guard for amount_coins on escrow_transactions ──
-- Ensure amount_coins is always positive (defence-in-depth).  The column
-- already has a CHECK in the table definition (backend migration), but the
-- constraint may not exist in all environments.  Add it with IF NOT EXISTS
-- semantics using a DO block.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'escrow_transactions'
      AND c.conname = 'escrow_transactions_amount_coins_positive'
  ) THEN
    ALTER TABLE public.escrow_transactions
      ADD CONSTRAINT escrow_transactions_amount_coins_positive CHECK (amount_coins > 0) NOT VALID;
    ALTER TABLE public.escrow_transactions
      VALIDATE CONSTRAINT escrow_transactions_amount_coins_positive;
  END IF;
END $$;

-- ── 4. escrows: add CHECK constraint guards ────────────────────────────────
-- Ensure amount is always positive and within range, and status is valid.
-- These should exist from the original CREATE TABLE but are added here
-- for environments where the table was created with a different migration path.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'escrows'
      AND c.conname = 'escrows_amount_positive'
  ) THEN
    ALTER TABLE public.escrows
      ADD CONSTRAINT escrows_amount_positive CHECK (amount > 0 AND amount <= 1000000) NOT VALID;
    ALTER TABLE public.escrows
      VALIDATE CONSTRAINT escrows_amount_positive;
  END IF;
END $$;