-- Support newest-first moderation pagination and bounded creation-time investigation.

CREATE INDEX IF NOT EXISTS idx_reports_created_at_desc
    ON public.reports(created_at DESC);
