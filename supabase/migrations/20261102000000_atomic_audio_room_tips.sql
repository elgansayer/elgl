-- Make audio-room tips atomic and safe to retry.
--
-- The nullable columns preserve writes from older application versions during
-- rollout. New clients provide an idempotency key and receive the balances
-- committed by the same database transaction as the tip audit row.

ALTER TABLE public.audio_room_tips
    ADD COLUMN IF NOT EXISTS idempotency_key UUID,
    ADD COLUMN IF NOT EXISTS sender_balance_after INTEGER,
    ADD COLUMN IF NOT EXISTS receiver_balance_after INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS audio_room_tips_sender_idempotency_idx
    ON public.audio_room_tips (sender_user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Tip rows are financial audit records and include committed wallet balance
-- snapshots. Browser roles must use the authenticated API rather than reading,
-- forging or removing these records directly.
DROP POLICY IF EXISTS audio_room_tips_select_own ON public.audio_room_tips;
DROP POLICY IF EXISTS "Users can view own tips" ON public.audio_room_tips;
DROP POLICY IF EXISTS audio_room_tips_select_admin ON public.audio_room_tips;
DROP POLICY IF EXISTS audio_room_tips_insert_own ON public.audio_room_tips;
DROP POLICY IF EXISTS audio_room_tips_delete_own ON public.audio_room_tips;
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.audio_room_tips
    FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audio_room_tips
    TO service_role;

CREATE OR REPLACE FUNCTION public.transfer_audio_room_tip(
    p_room_id UUID,
    p_sender_id UUID,
    p_amount INTEGER,
    p_idempotency_key UUID
)
RETURNS TABLE (
    tip_id UUID,
    amount_coins INTEGER,
    receiver_id UUID,
    sender_new_balance INTEGER,
    receiver_new_balance INTEGER,
    sender_name TEXT,
    receiver_name TEXT,
    created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.audio_rooms%ROWTYPE;
    v_existing public.audio_room_tips%ROWTYPE;
    v_sender_balance INTEGER;
    v_receiver_balance INTEGER;
    v_sender_name TEXT;
    v_receiver_name TEXT;
    v_tip_id UUID;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'tip idempotency key is required';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'tip amount must be positive';
    END IF;

    SELECT * INTO v_room
    FROM public.audio_rooms ar
    WHERE ar.id = p_room_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'room not found';
    END IF;

    IF v_room.host_id = p_sender_id THEN
        RAISE EXCEPTION 'sender cannot tip self';
    END IF;

    -- Only viewers admitted through generateToken may mutate wallets or
    -- broadcast into this room. Private-room invitations are checked before
    -- that path records participation, and browser roles cannot forge rows.
    IF NOT EXISTS (
        SELECT 1
        FROM public.audio_room_participants participant
        WHERE participant.room_id = p_room_id
          AND participant.user_id = p_sender_id
    ) THEN
        RAISE EXCEPTION 'sender is not a room participant';
    END IF;

    -- Lock both wallets in stable UUID order. This prevents lost updates and
    -- avoids deadlocks when two users tip each other in different rooms.
    PERFORM u.id
    FROM public.users u
    WHERE u.id IN (p_sender_id, v_room.host_id)
    ORDER BY u.id
    FOR UPDATE;

    SELECT COALESCE(u.coins_balance, 0), COALESCE(u.display_name, '')
    INTO v_sender_balance, v_sender_name
    FROM public.users u
    WHERE u.id = p_sender_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sender not found';
    END IF;

    SELECT COALESCE(u.coins_balance, 0), COALESCE(u.display_name, '')
    INTO v_receiver_balance, v_receiver_name
    FROM public.users u
    WHERE u.id = v_room.host_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'receiver not found';
    END IF;

    SELECT * INTO v_existing
    FROM public.audio_room_tips art
    WHERE art.sender_user_id = p_sender_id
      AND art.idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.room_id <> p_room_id
           OR v_existing.receiver_user_id <> v_room.host_id
           OR v_existing.amount_coins <> p_amount THEN
            RAISE EXCEPTION 'tip idempotency subject mismatch';
        END IF;

        RETURN QUERY SELECT
            v_existing.id,
            v_existing.amount_coins,
            v_existing.receiver_user_id,
            COALESCE(v_existing.sender_balance_after, v_sender_balance),
            COALESCE(v_existing.receiver_balance_after, v_receiver_balance),
            v_sender_name,
            v_receiver_name,
            FALSE;
        RETURN;
    END IF;

    -- A retry replays an already-committed result even if the room ended after
    -- the original transfer. Only a new transfer requires an active room.
    IF NOT v_room.is_active THEN
        RAISE EXCEPTION 'room is not active';
    END IF;

    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'insufficient coins';
    END IF;

    UPDATE public.users
    SET coins_balance = v_sender_balance - p_amount
    WHERE id = p_sender_id
    RETURNING coins_balance INTO v_sender_balance;

    UPDATE public.users
    SET coins_balance = v_receiver_balance + p_amount
    WHERE id = v_room.host_id
    RETURNING coins_balance INTO v_receiver_balance;

    INSERT INTO public.audio_room_tips (
        room_id,
        sender_user_id,
        receiver_user_id,
        amount_coins,
        idempotency_key,
        sender_balance_after,
        receiver_balance_after
    ) VALUES (
        p_room_id,
        p_sender_id,
        v_room.host_id,
        p_amount,
        p_idempotency_key,
        v_sender_balance,
        v_receiver_balance
    )
    RETURNING id INTO v_tip_id;

    RETURN QUERY SELECT
        v_tip_id,
        p_amount,
        v_room.host_id,
        v_sender_balance,
        v_receiver_balance,
        v_sender_name,
        v_receiver_name,
        TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_audio_room_tip(UUID, UUID, INTEGER, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_audio_room_tip(UUID, UUID, INTEGER, UUID)
    TO service_role;
