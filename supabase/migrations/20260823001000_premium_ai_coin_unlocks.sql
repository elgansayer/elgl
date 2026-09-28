-- Coin-funded, one-off premium AI services.
--
-- The database owns pricing, charging, idempotency, refund and room-membership
-- checks so retries or concurrent requests cannot double-charge a learner.

CREATE TABLE IF NOT EXISTS public.premium_ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    service_key TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    cost_coins INTEGER NOT NULL CHECK (cost_coins > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    result JSONB,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT premium_ai_runs_supported_service CHECK (service_key IN ('conversation_analysis_report')),
    CONSTRAINT premium_ai_runs_user_request_unique UNIQUE (user_id, service_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS premium_ai_runs_user_created_idx
    ON public.premium_ai_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS premium_ai_runs_subject_idx
    ON public.premium_ai_runs (subject_id, created_at DESC);

ALTER TABLE public.premium_ai_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS premium_ai_runs_select_own ON public.premium_ai_runs;
CREATE POLICY premium_ai_runs_select_own ON public.premium_ai_runs
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Mutations stay backend-only. Authenticated clients may inspect their own
-- completed purchases, but cannot grant, complete or refund them directly.
REVOKE INSERT, UPDATE, DELETE ON public.premium_ai_runs FROM anon, authenticated;
GRANT SELECT ON public.premium_ai_runs TO authenticated;

CREATE OR REPLACE FUNCTION public.start_premium_ai_service(
    p_user_id UUID,
    p_service_key TEXT,
    p_subject_id UUID,
    p_idempotency_key UUID
)
RETURNS TABLE (
    run_id UUID,
    run_status TEXT,
    run_cost_coins INTEGER,
    coins_remaining INTEGER,
    run_result JSONB,
    created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cost INTEGER;
    v_balance INTEGER;
    v_run public.premium_ai_runs%ROWTYPE;
BEGIN
    v_cost := CASE p_service_key
        WHEN 'conversation_analysis_report' THEN 30
        ELSE NULL
    END;

    IF v_cost IS NULL THEN
        RAISE EXCEPTION 'unsupported premium ai service';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.chat_room_members crm
        WHERE crm.room_id = p_subject_id
          AND crm.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'room access denied';
    END IF;

    SELECT * INTO v_run
    FROM public.premium_ai_runs par
    WHERE par.user_id = p_user_id
      AND par.service_key = p_service_key
      AND par.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        SELECT COALESCE(u.coins_balance, 0) INTO v_balance
        FROM public.users u
        WHERE u.id = p_user_id;

        RETURN QUERY SELECT
            v_run.id,
            v_run.status,
            v_run.cost_coins,
            COALESCE(v_balance, 0),
            v_run.result,
            FALSE;
        RETURN;
    END IF;

    -- Serialise all balance mutations for the user. Re-check idempotency after
    -- taking the lock so two simultaneous requests with the same key cannot
    -- both charge.
    SELECT COALESCE(u.coins_balance, 0) INTO v_balance
    FROM public.users u
    WHERE u.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found';
    END IF;

    SELECT * INTO v_run
    FROM public.premium_ai_runs par
    WHERE par.user_id = p_user_id
      AND par.service_key = p_service_key
      AND par.idempotency_key = p_idempotency_key;

    IF FOUND THEN
        RETURN QUERY SELECT
            v_run.id,
            v_run.status,
            v_run.cost_coins,
            v_balance,
            v_run.result,
            FALSE;
        RETURN;
    END IF;

    IF v_balance < v_cost THEN
        RAISE EXCEPTION 'insufficient coins';
    END IF;

    UPDATE public.users
    SET coins_balance = v_balance - v_cost
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    INSERT INTO public.premium_ai_runs (
        user_id,
        service_key,
        subject_id,
        idempotency_key,
        cost_coins,
        status
    ) VALUES (
        p_user_id,
        p_service_key,
        p_subject_id,
        p_idempotency_key,
        v_cost,
        'pending'
    )
    RETURNING * INTO v_run;

    INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'premium_ai_spend',
        -v_cost,
        'Premium AI service',
        jsonb_build_object('run_id', v_run.id, 'service_key', p_service_key)
    );

    RETURN QUERY SELECT
        v_run.id,
        v_run.status,
        v_run.cost_coins,
        v_balance,
        NULL::JSONB,
        TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_premium_ai_service(
    p_user_id UUID,
    p_run_id UUID,
    p_result JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.premium_ai_runs
    SET status = 'completed',
        result = p_result,
        error_code = NULL,
        updated_at = now()
    WHERE id = p_run_id
      AND user_id = p_user_id
      AND status = 'pending';

    IF FOUND THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.premium_ai_runs
        WHERE id = p_run_id
          AND user_id = p_user_id
          AND status = 'completed'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_premium_ai_service(
    p_user_id UUID,
    p_run_id UUID,
    p_error_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run public.premium_ai_runs%ROWTYPE;
BEGIN
    SELECT * INTO v_run
    FROM public.premium_ai_runs
    WHERE id = p_run_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_run.status <> 'pending' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.users
    SET coins_balance = COALESCE(coins_balance, 0) + v_run.cost_coins
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found';
    END IF;

    UPDATE public.premium_ai_runs
    SET status = 'failed',
        result = NULL,
        error_code = LEFT(COALESCE(p_error_code, 'provider_failure'), 64),
        updated_at = now()
    WHERE id = p_run_id;

    INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'premium_ai_refund',
        v_run.cost_coins,
        'Premium AI service refund',
        jsonb_build_object('run_id', v_run.id, 'service_key', v_run.service_key)
    );

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.start_premium_ai_service(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_premium_ai_service(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_premium_ai_service(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_premium_ai_service(UUID, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_premium_ai_service(UUID, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_premium_ai_service(UUID, UUID, TEXT) TO service_role;
