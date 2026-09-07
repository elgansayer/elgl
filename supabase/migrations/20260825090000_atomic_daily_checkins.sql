-- Make daily check-in rewards database-authoritative and idempotent.
-- The application service role is the only caller allowed to execute the claim RPC.

CREATE TABLE IF NOT EXISTS public.daily_checkins (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    checkin_date DATE NOT NULL,
    reward SMALLINT NOT NULL CHECK (reward BETWEEN 5 AND 10),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS daily_checkins_created_idx
    ON public.daily_checkins (created_at DESC);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

-- Daily claims are an application-server mutation. Do not expose direct table
-- mutation or the SECURITY DEFINER function to browser roles.
REVOKE ALL ON TABLE public.daily_checkins FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.daily_checkins TO service_role;

CREATE OR REPLACE FUNCTION public.claim_daily_checkin(p_user_id UUID)
RETURNS TABLE (
    claimed BOOLEAN,
    coins_rewarded INTEGER,
    new_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_checkin_date DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_reward INTEGER := floor(random() * 6)::INTEGER + 5;
    v_balance INTEGER;
BEGIN
    -- Serialize claims for one user. Concurrent/retried requests then observe
    -- the same daily_checkins row rather than granting twice.
    SELECT coins_balance
      INTO v_balance
      FROM public.users
     WHERE id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM public.daily_checkins
         WHERE user_id = p_user_id
           AND checkin_date = v_checkin_date
    ) THEN
        RETURN QUERY SELECT FALSE, 0, v_balance;
        RETURN;
    END IF;

    v_balance := v_balance + v_reward;

    UPDATE public.users
       SET coins_balance = v_balance
     WHERE id = p_user_id;

    INSERT INTO public.daily_checkins (
        user_id,
        checkin_date,
        reward,
        balance_after
    ) VALUES (
        p_user_id,
        v_checkin_date,
        v_reward,
        v_balance
    );

    INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'daily_checkin',
        v_reward,
        'Daily check-in reward',
        jsonb_build_object('coins_after', v_balance, 'checkin_date', v_checkin_date)
    );

    RETURN QUERY SELECT TRUE, v_reward, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_checkin(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin(UUID) TO service_role;
