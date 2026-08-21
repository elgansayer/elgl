-- Support exact reported-user moderation filtering with newest-first pagination
-- when status is not part of the query predicate.

CREATE INDEX IF NOT EXISTS idx_reports_reported_user_created_at
    ON public.reports(reported_user_id, created_at DESC);
