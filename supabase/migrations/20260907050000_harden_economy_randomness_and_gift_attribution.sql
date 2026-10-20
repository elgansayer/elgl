-- Keep the daily check-in mutation atomic while sourcing its reward from the
-- application CSPRNG. The database validates the value again at the trust
-- boundary and the obsolete one-argument overload is no longer executable.

CREATE OR REPLACE FUNCTION public.claim_daily_checkin(
    p_user_id UUID,
    p_reward INTEGER
)
RETURNS TABLE (
    claimed BOOLEAN,
    coins_rewarded INTEGER,
    new_balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_checkin_date DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_balance INTEGER;
BEGIN
    IF p_reward < 5 OR p_reward > 10 THEN
        RAISE EXCEPTION 'daily check-in reward out of range'
            USING ERRCODE = '22003';
    END IF;

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

    v_balance := v_balance + p_reward;

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
        p_reward,
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
        p_reward,
        'Daily check-in reward',
        jsonb_build_object('coins_after', v_balance, 'checkin_date', v_checkin_date)
    );

    RETURN QUERY SELECT TRUE, p_reward, v_balance;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_daily_checkin(UUID) FROM service_role;
REVOKE ALL ON FUNCTION public.claim_daily_checkin(UUID, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin(UUID, INTEGER)
    TO service_role;

-- room_id is client supplied, so enforce the receiver-to-host relationship at
-- the insert boundary. This keeps per-room host totals authoritative even if
-- an application caller omits its own validation.
CREATE OR REPLACE FUNCTION public.validate_gift_transaction_room_host()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NEW.room_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM public.audio_rooms
         WHERE id = NEW.room_id
           AND host_id = NEW.receiver_id
    ) THEN
        RAISE EXCEPTION 'gift receiver must host the attributed room'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_gift_transaction_room_host()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS gift_transactions_room_host_guard
    ON public.gift_transactions;
CREATE TRIGGER gift_transactions_room_host_guard
    BEFORE INSERT OR UPDATE OF room_id, receiver_id
    ON public.gift_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_gift_transaction_room_host();
