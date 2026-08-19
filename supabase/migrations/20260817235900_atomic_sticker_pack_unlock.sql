-- Migration: Make sticker-pack unlocks atomic and idempotent.
-- Issue #389: spending coins and acquiring ownership must commit together.

CREATE OR REPLACE FUNCTION public.unlock_sticker_pack_atomic(
    p_user_id UUID,
    p_pack_id VARCHAR
)
RETURNS TABLE (
    success BOOLEAN,
    newly_unlocked BOOLEAN,
    coins_remaining INTEGER,
    pack_id VARCHAR,
    pack_name VARCHAR,
    pack_cost_coins INTEGER,
    pack_is_animated BOOLEAN,
    pack_sticker_urls TEXT[],
    pack_animation_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pack public.sticker_packs%ROWTYPE;
    v_balance INTEGER;
BEGIN
    SELECT *
    INTO v_pack
    FROM public.sticker_packs
    WHERE id = p_pack_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STICKER_PACK_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- Serialise all sticker unlocks for a user. A concurrent duplicate waits
    -- here, then observes the ownership row created by the first transaction.
    SELECT coins_balance
    INTO v_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'USER_NOT_FOUND'
            USING ERRCODE = 'P0002';
    END IF;

    -- Retrying an already-completed unlock is a successful no-op. Returning
    -- the persisted balance makes retries idempotent and prevents double spend.
    IF EXISTS (
        SELECT 1
        FROM public.user_sticker_packs
        WHERE user_id = p_user_id
          AND user_sticker_packs.pack_id = p_pack_id
    ) THEN
        RETURN QUERY
        SELECT
            TRUE,
            FALSE,
            v_balance,
            v_pack.id,
            v_pack.name,
            v_pack.cost_coins,
            v_pack.is_animated,
            v_pack.sticker_urls,
            v_pack.animation_url;
        RETURN;
    END IF;

    IF v_balance < v_pack.cost_coins THEN
        RAISE EXCEPTION 'INSUFFICIENT_COINS'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.users
    SET coins_balance = coins_balance - v_pack.cost_coins
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    -- The UNIQUE(user_id, pack_id) constraint remains the final integrity
    -- guard. Any insert failure aborts this function call and rolls back the
    -- balance deduction in the same PostgreSQL transaction.
    INSERT INTO public.user_sticker_packs (user_id, pack_id)
    VALUES (p_user_id, p_pack_id);

    RETURN QUERY
    SELECT
        TRUE,
        TRUE,
        v_balance,
        v_pack.id,
        v_pack.name,
        v_pack.cost_coins,
        v_pack.is_animated,
        v_pack.sticker_urls,
        v_pack.animation_url;
END;
$$;

REVOKE ALL ON FUNCTION public.unlock_sticker_pack_atomic(UUID, VARCHAR)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_sticker_pack_atomic(UUID, VARCHAR)
    TO service_role;

COMMENT ON FUNCTION public.unlock_sticker_pack_atomic(UUID, VARCHAR) IS
    'Atomically spends coins and unlocks one sticker pack. Retries for an already-owned pack are successful no-ops.';
