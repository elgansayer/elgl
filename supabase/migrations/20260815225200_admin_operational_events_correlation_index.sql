-- Support exact correlation-ID investigation while preserving newest-first ordering.
CREATE INDEX IF NOT EXISTS idx_admin_operational_events_correlation_created_at
    ON public.admin_operational_events(correlation_id, created_at DESC)
    WHERE correlation_id IS NOT NULL;
