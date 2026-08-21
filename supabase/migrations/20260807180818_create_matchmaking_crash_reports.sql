-- Migration: Create matchmaking_crash_reports table for error boundary handling
-- Fixes #2291: Implements robust error boundary handling and crash reporting for Matchmaking Algorithm

CREATE TABLE IF NOT EXISTS public.matchmaking_crash_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    error_type VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context JSONB DEFAULT '{}'::jsonb,
    circuit_breaker_open BOOLEAN DEFAULT false,
    degraded_tier VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_crash_reports_created
    ON public.matchmaking_crash_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matchmaking_crash_reports_user
    ON public.matchmaking_crash_reports (user_id);

CREATE INDEX IF NOT EXISTS idx_matchmaking_crash_reports_unresolved
    ON public.matchmaking_crash_reports (resolved_at)
    WHERE resolved_at IS NULL;
