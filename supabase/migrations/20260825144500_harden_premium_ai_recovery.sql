-- Harden coin-funded premium AI retries and crash recovery.
--
-- This forward migration deliberately leaves the original migration untouched.
-- It preserves the public RPC signatures while making idempotency keys
-- subject-bound, recovering abandoned pending charges on retry, and using a
-- consistent user -> run lock order for all balance-changing mutations.

CREATE INDEX IF NOT EXISTS premium_ai_runs_pending_updated_idx
    ON public.premium_ai_runs (updated_at)
    WHERE status = 'pending';

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

    -- All premium-AI balance mutations lock the user before an existing run.
    -- This serialises purchases/refunds for one wallet and avoids the opposite
    -- run -> user lock order that can deadlock under retries.
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
      AND par.idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- An idempotency key represents exactly one subject. Without this
        -- check, reusing a key for another accessible room could return the
        -- saved analysis for the first room.
        IF v_run.subject_id <> p_subject_id THEN
            RAISE EXCEPTION 'premium ai idempotency subject mismatch';
        END IF;

        -- Provider work is bounded to seconds. A pending row older than five
        -- minutes therefore represents an abandoned/crashed application run.
        -- Recover it atomically before returning so the learner is never left
        -- permanently charged. The failed row remains as the audit record and
        -- callers must use a fresh idempotency key for a new purchase.
        IF v_run.status = 'pending'
           AND v_run.updated_at <= now() - INTERVAL '5 minutes' THEN
            UPDATE public.users
            SET coins_balance = COALESCE(coins_balance, 0) + v_run.cost_coins
            WHERE id = p_user_id
            RETURNING coins_balance INTO v_balance;

            UPDATE public.premium_ai_runs
            SET status = 'failed',
                result = NULL,
                error_code = 'stale_timeout',
                updated_at = now()
            WHERE id = v_run.id;

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
                'Premium AI service stale-run refund',
                jsonb_build_object(
                    'run_id', v_run.id,
                    'service_key', v_run.service_key,
                    'reason', 'stale_timeout'
                )
            );

            RETURN QUERY SELECT
                v_run.id,
                'failed'::TEXT,
                v_run.cost_coins,
                v_balance,
                NULL::JSONB,
                FALSE;
            RETURN;
        END IF;

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
    v_balance INTEGER;
BEGIN
    -- Match start_premium_ai_service's user -> run lock order.
    SELECT COALESCE(u.coins_balance, 0) INTO v_balance
    FROM public.users u
    WHERE u.id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    SELECT * INTO v_run
    FROM public.premium_ai_runs
    WHERE id = p_run_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND OR v_run.status <> 'pending' THEN
        RETURN FALSE;
    END IF;

    UPDATE public.users
    SET coins_balance = v_balance + v_run.cost_coins
    WHERE id = p_user_id;

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
REVOKE ALL ON FUNCTION public.fail_premium_ai_service(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_premium_ai_service(UUID, TEXT, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_premium_ai_service(UUID, UUID, TEXT) TO service_role;
