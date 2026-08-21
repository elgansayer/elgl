-- Support exact reporter-user moderation filtering with newest-first pagination.

CREATE INDEX IF NOT EXISTS idx_reports_reporter_created_at
    ON public.reports(reporter_id, created_at DESC)
    WHERE reporter_id IS NOT NULL;
