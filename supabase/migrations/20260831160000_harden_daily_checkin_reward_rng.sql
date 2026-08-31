-- Generate daily check-in rewards with cryptographically secure randomness.
-- The database RPC is the production-authoritative claim boundary. The loop
-- rejects the top four byte values so mapping onto six rewards is unbiased.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
    v_random_byte INTEGER;
    v_reward INTEGER;
    v_balance INTEGER;
BEGIN
    -- 252 is the largest multiple of six below 256. Rejection sampling avoids
    -- the modulo bias that would otherwise favour four of the six rewards.
    LOOP
        v_random_byte := get_byte(gen_random_bytes(1), 0);
        EXIT WHEN v_random_byte < 252;
    END LOOP;
    v_reward := (v_random_byte % 6) + 5;

    -- Serialize claims for one user. Concurrent or retried requests then
    -- observe the same daily_checkins row rather than granting twice.
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
