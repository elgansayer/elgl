-- Weekly community leaderboards: top correctors and study hours.
--
-- Rankings are calculated for the current UTC week (Monday 00:00 UTC through
-- the following Monday) rather than from lifetime counters, so the board
-- resets every week and reflects recent habit-loop activity.
--
-- Sources:
--   * correctors   - moment_comments rows that carry a correction payload.
--   * study_hours  - call_logs duration_seconds for calls started this week.
--                    A call counts towards both participants, matching the
--                    existing /stats/me definition of study time.
--
-- The aggregation runs as a SECURITY DEFINER function because browser roles
-- must not be able to scan another user's call history or correction rows.
-- Only the service-role backend may execute it, and it returns aggregate
-- scores plus public profile fields only. Accounts marked is_deleted (GDPR
-- deletion) are excluded so erased users never appear on the public board.

-- Supports the weekly correction aggregation without scanning uncorrected
-- comments. Migrations are append-only, so create the index idempotently.
CREATE INDEX IF NOT EXISTS moment_comments_correction_created_idx
    ON public.moment_comments (created_at DESC)
    WHERE correction_payload IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    category TEXT,
    user_id UUID,
    display_name TEXT,
    avatar_url TEXT,
    score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_week_start TIMESTAMPTZ;
    v_week_end TIMESTAMPTZ;
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'leaderboard limit must be between 1 and 100';
    END IF;

    -- date_trunc('week', ...) is Monday-based. Convert the UTC wall clock back
    -- to an absolute instant so comparisons stay correct regardless of the
    -- database session time zone.
    v_week_start := date_trunc('week', (now() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC';
    v_week_end := v_week_start + INTERVAL '7 days';

    RETURN QUERY
    WITH correctors AS (
        SELECT
            u.id AS ranked_user_id,
            u.display_name AS ranked_display_name,
            u.avatar_url AS ranked_avatar_url,
            COUNT(*)::NUMERIC AS ranked_score
        FROM public.moment_comments AS mc
        INNER JOIN public.users AS u ON u.id = mc.user_id
        WHERE mc.correction_payload IS NOT NULL
          AND u.is_deleted = false
          AND mc.created_at >= v_week_start
          AND mc.created_at < v_week_end
        GROUP BY u.id, u.display_name, u.avatar_url
        ORDER BY ranked_score DESC, u.id
        LIMIT p_limit
    ),
    call_participants AS (
        SELECT
            cl.caller_id AS participant_user_id,
            LEAST(GREATEST(cl.duration_seconds, 0), 86400) AS participant_seconds
        FROM public.call_logs AS cl
        WHERE cl.started_at >= v_week_start
          AND cl.started_at < v_week_end
          AND cl.duration_seconds IS NOT NULL
          AND cl.duration_seconds > 0
        UNION ALL
        SELECT
            cl.receiver_id,
            LEAST(GREATEST(cl.duration_seconds, 0), 86400)
        FROM public.call_logs AS cl
        WHERE cl.started_at >= v_week_start
          AND cl.started_at < v_week_end
          AND cl.duration_seconds IS NOT NULL
          AND cl.duration_seconds > 0
    ),
    study_hours AS (
        SELECT
            u.id AS ranked_user_id,
            u.display_name AS ranked_display_name,
            u.avatar_url AS ranked_avatar_url,
            ROUND(SUM(cp.participant_seconds)::NUMERIC / 3600.0, 1) AS ranked_score
        FROM call_participants AS cp
        INNER JOIN public.users AS u ON u.id = cp.participant_user_id
        WHERE u.is_deleted = false
        GROUP BY u.id, u.display_name, u.avatar_url
        ORDER BY ranked_score DESC, u.id
        LIMIT p_limit
    )
    SELECT 'correctors'::TEXT, ranked_user_id, ranked_display_name, ranked_avatar_url, ranked_score
    FROM correctors
    UNION ALL
    SELECT 'study_hours'::TEXT, ranked_user_id, ranked_display_name, ranked_avatar_url, ranked_score
    FROM study_hours;
END;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_leaderboard(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(INTEGER) TO service_role;

COMMENT ON FUNCTION public.get_weekly_leaderboard(INTEGER) IS
    'Service-role-only weekly leaderboard. Returns up to p_limit aggregate rows per category (correctors, study_hours) for the current UTC week.';

COMMENT ON INDEX public.moment_comments_correction_created_idx IS
    'Supports weekly corrector leaderboard aggregation over corrected comments.';
