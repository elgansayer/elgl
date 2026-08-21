-- Support bounded newest-first moderation investigations used by /admin/v1/moderation/reports.
-- These indexes preserve the existing read contract while avoiding full-sort scans as
-- the reports table grows.

CREATE INDEX IF NOT EXISTS reports_status_created_at_idx
  ON public.reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_reason_category_created_at_idx
  ON public.reports (reason_category, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_reported_user_created_at_idx
  ON public.reports (reported_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reports_reporter_created_at_idx
  ON public.reports (reporter_id, created_at DESC)
  WHERE reporter_id IS NOT NULL;
