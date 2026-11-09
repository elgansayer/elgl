-- Migration: Record Developer Tier API usage (#1861)
--
-- The Developer analytics dashboard reads public.developer_metrics, but no
-- production code path wrote to it, so every developer saw zero calls and zero
-- latency. This function provides an atomic, service-role-only write path used
-- by the backend after a developer API key successfully authenticates.
--
-- The daily counter resets on the first authenticated call of a new UTC day and
-- the average latency is maintained as a running mean without a full-table
-- scan. The function is safe to retry: it only ever increments, and callers do
-- not depend on its return value.

CREATE OR REPLACE FUNCTION public.record_developer_api_usage(
  p_user_id UUID,
  p_latency_ms INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  safe_latency INTEGER := GREATEST(COALESCE(p_latency_ms, 0), 0);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  -- A single upsert keeps concurrent first calls safe: one inserts and the
  -- others update the same row through ON CONFLICT instead of racing into a
  -- unique violation. Both CASE expressions read the pre-update values, so the
  -- running average is computed from the previous total.
  INSERT INTO public.developer_metrics AS metrics (
    user_id,
    total_api_calls_today,
    avg_latency_ms,
    updated_at
  )
  VALUES (p_user_id, 1, safe_latency, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    total_api_calls_today = CASE
      WHEN metrics.updated_at IS NULL
        OR metrics.updated_at < date_trunc('day', now())
      THEN 1
      ELSE metrics.total_api_calls_today + 1
    END,
    avg_latency_ms = CASE
      WHEN metrics.updated_at IS NULL
        OR metrics.updated_at < date_trunc('day', now())
      THEN EXCLUDED.avg_latency_ms
      ELSE ((metrics.avg_latency_ms * metrics.total_api_calls_today)
        + EXCLUDED.avg_latency_ms) / (metrics.total_api_calls_today + 1)
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_developer_api_usage(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_developer_api_usage(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.record_developer_api_usage(UUID, INTEGER) IS
  'Atomically records one authenticated Developer Tier API call for the current UTC day, updating the running average latency.';
