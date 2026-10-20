-- Refund premium AI purchases left pending by a process crash or lost worker.
-- Provider work is bounded to seconds, so fifteen minutes is deliberately far
-- outside the normal request lifetime and avoids racing healthy requests.

CREATE OR REPLACE FUNCTION public.refund_stale_premium_ai_runs(
    p_limit INTEGER DEFAULT 100
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run public.premium_ai_runs%ROWTYPE;
    v_refunded INTEGER := 0;
BEGIN
    IF p_limit < 1 OR p_limit > 500 THEN
        RAISE EXCEPTION 'limit must be between 1 and 500';
    END IF;

    FOR v_run IN
        SELECT par.*
        FROM public.premium_ai_runs par
        WHERE par.status = 'pending'
          AND par.created_at < now() - INTERVAL '15 minutes'
        ORDER BY par.created_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE public.users
        SET coins_balance = COALESCE(coins_balance, 0) + v_run.cost_coins
        WHERE id = v_run.user_id;

        IF NOT FOUND THEN
            -- ON DELETE CASCADE normally removes the run with its user. If a
            -- legacy/inconsistent row remains, fail closed rather than claim a
            -- refund that could not be applied.
            CONTINUE;
        END IF;

        UPDATE public.premium_ai_runs
        SET status = 'failed',
            result = NULL,
            error_code = 'stale_worker_refund',
            updated_at = now()
        WHERE id = v_run.id
          AND status = 'pending';

        IF NOT FOUND THEN
            -- The row is locked by this transaction, so this should be
            -- unreachable. Raising rolls back the balance mutation too.
            RAISE EXCEPTION 'premium ai run changed during reconciliation';
        END IF;

        INSERT INTO public.coin_transactions (
            user_id,
            type,
            amount,
            description,
            metadata
        ) VALUES (
            v_run.user_id,
            'premium_ai_refund',
            v_run.cost_coins,
            'Premium AI stale-run refund',
            jsonb_build_object(
                'run_id', v_run.id,
                'service_key', v_run.service_key,
                'reason', 'stale_worker_refund'
            )
        );

        v_refunded := v_refunded + 1;
    END LOOP;

    RETURN v_refunded;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_stale_premium_ai_runs(INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_stale_premium_ai_runs(INTEGER)
    TO service_role;
