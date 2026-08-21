-- Support bounded newest-first operational-event investigation by exact source.
CREATE INDEX IF NOT EXISTS idx_admin_operational_events_source_created_at
    ON public.admin_operational_events(source, created_at DESC)
    WHERE source IS NOT NULL;
