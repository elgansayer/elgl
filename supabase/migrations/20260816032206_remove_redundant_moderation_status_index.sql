-- Remove the duplicate moderation status/recency index introduced by
-- 20260816013800_admin_moderation_investigation_indexes.sql.
-- idx_reports_status_created_at already covers the identical key order from
-- 20260807150000_admin_dashboard_performance_indices.sql.

DROP INDEX IF EXISTS public.reports_status_created_at_idx;
