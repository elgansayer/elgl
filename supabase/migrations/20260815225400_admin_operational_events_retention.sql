-- Backend-only retention primitive for sanitized admin operational events.
-- This deliberately has no public/admin-portal mutation endpoint.
CREATE OR REPLACE FUNCTION public.prune_admin_operational_events(
    p_before TIMESTAMPTZ
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted BIGINT;
BEGIN
    IF p_before IS NULL THEN
        RAISE EXCEPTION 'retention cutoff is required';
    END IF;

    -- Guard against accidentally deleting recent incident data.
    IF p_before > now() - INTERVAL '7 days' THEN
        RAISE EXCEPTION 'retention cutoff must be at least 7 days old';
    END IF;

    DELETE FROM public.admin_operational_events
    WHERE created_at < p_before;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_admin_operational_events(TIMESTAMPTZ)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_admin_operational_events(TIMESTAMPTZ)
    TO service_role;
