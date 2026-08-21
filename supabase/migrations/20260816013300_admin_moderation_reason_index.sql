-- Support exact moderation reason-category filtering with newest-first pagination.

CREATE INDEX IF NOT EXISTS idx_reports_reason_created_at
    ON public.reports(reason_category, created_at DESC);
