-- Atomic, once-per-UTC-day daily login rewards.
--
-- The previous application path used Redis as the source of truth and then
-- performed a read/modify/write of users.coins_balance. That allowed duplicate
-- grants when Redis was unavailable and lost updates under concurrent economy
-- mutations. This migration moves idempotency, balance mutation, and ledger
-- recording into one PostgreSQL transaction.

CREATE TABLE IF NOT EXISTS public.daily_checkin_claims (
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    coins_rewarded SMALLINT NOT NULL CHECK (coins_rewarded BETWEEN 5 AND 10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, claim_date)
);

ALTER TABLE public.daily_checkin_claims ENABLE ROW LEVEL SECURITY;

-- Claim markers are backend economy state. Browser clients do not need direct
-- access; the authenticated NestJS API exposes only the current claim result.
REVOKE ALL ON TABLE public.daily_checkin_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.daily_checkin_claims TO service_role;

CREATE OR REPLACE FUNCTION public.claim_daily_checkin_reward(
    p_user_id UUID,
    p_reward SMALLINT
)
RETURNS TABLE (
    claimed BOOLEAN,
    coins_rewarded INTEGER,
    new_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_claim_date DATE := (now() AT TIME ZONE 'UTC')::date;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_inserted_user_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;

    IF p_reward IS NULL OR p_reward < 5 OR p_reward > 10 THEN
        RAISE EXCEPTION 'daily check-in reward must be between 5 and 10 coins';
    END IF;

    -- Lock the balance row first so this mutation is serialized with other
    -- correctly implemented economy mutations for the same user.
    SELECT COALESCE(u.coins_balance, 0)
      INTO v_current_balance
      FROM public.users AS u
     WHERE u.id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found';
    END IF;

    INSERT INTO public.daily_checkin_claims (user_id, claim_date, coins_rewarded)
    VALUES (p_user_id, v_claim_date, p_reward)
    ON CONFLICT (user_id, claim_date) DO NOTHING
    RETURNING user_id INTO v_inserted_user_id;

    -- A retry/concurrent request for the same UTC day is a successful,
    -- idempotent no-op. Return the authoritative current balance.
    IF v_inserted_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, v_current_balance;
        RETURN;
    END IF;

    UPDATE public.users
       SET coins_balance = COALESCE(coins_balance, 0) + p_reward
     WHERE id = p_user_id
     RETURNING coins_balance INTO v_new_balance;

    -- Keep the economy ledger in the same transaction as the balance and
    -- idempotency marker. Any insert failure rolls the entire function back.
    INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'daily_checkin',
        p_reward,
        'Daily check-in reward',
        jsonb_build_object('claim_date', v_claim_date)
    );

    RETURN QUERY SELECT TRUE, p_reward::INTEGER, v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_checkin_reward(UUID, SMALLINT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin_reward(UUID, SMALLINT)
    TO service_role;

COMMENT ON TABLE public.daily_checkin_claims IS
    'One compact claim marker per account per UTC day. Deleted automatically with the owning user.';
COMMENT ON FUNCTION public.claim_daily_checkin_reward(UUID, SMALLINT) IS
    'Atomically grants an authenticated backend-selected 5-10 coin daily reward at most once per UTC day.';
