-- Atomic coin balance mutation helpers.
-- Avoid application-side read/modify/write races when multiple features award or deduct coins concurrently.

CREATE OR REPLACE FUNCTION public.add_user_coins(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF p_amount < 0 THEN
        RAISE EXCEPTION 'amount must be non-negative';
    END IF;

    UPDATE public.users
    SET coins_balance = COALESCE(coins_balance, 0) + p_amount
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user not found';
    END IF;

    RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_user_coins(
    p_user_id UUID,
    p_amount INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF p_amount < 0 THEN
        RAISE EXCEPTION 'amount must be non-negative';
    END IF;

    UPDATE public.users
    SET coins_balance = COALESCE(coins_balance, 0) - p_amount
    WHERE id = p_user_id
      AND COALESCE(coins_balance, 0) >= p_amount
    RETURNING coins_balance INTO v_balance;

    IF FOUND THEN
        RETURN v_balance;
    END IF;

    IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'insufficient coins';
    END IF;

    RAISE EXCEPTION 'user not found';
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_coins(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.deduct_user_coins(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_coins(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_user_coins(UUID, INTEGER) TO service_role;
