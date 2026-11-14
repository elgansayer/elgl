-- Coin purchases must finalise the purchase record and credit the balance in
-- one transaction. The previous read-modify-write balance update could lose a
-- concurrent credit, and a failed balance update left a completed purchase
-- record behind for non-web stores.

CREATE OR REPLACE FUNCTION public.fulfil_coin_purchase(
    p_user_id UUID,
    p_package_id TEXT,
    p_coins_added INTEGER,
    p_amount_paid INTEGER,
    p_currency TEXT,
    p_receipt_token TEXT,
    p_platform TEXT,
    p_transaction_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purchase_id UUID;
    v_balance INTEGER;
BEGIN
    IF p_user_id IS NULL
       OR p_coins_added IS NULL OR p_coins_added <= 0
       OR p_amount_paid IS NULL OR p_amount_paid <= 0
       OR p_transaction_id IS NULL OR btrim(p_transaction_id) = ''
       OR p_receipt_token IS NULL OR btrim(p_receipt_token) = '' THEN
        RAISE EXCEPTION 'invalid_coin_purchase_arguments' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.coin_purchases (
        user_id,
        package_id,
        coins_added,
        amount_paid,
        currency,
        receipt_token,
        platform,
        transaction_id,
        status
    ) VALUES (
        p_user_id,
        p_package_id,
        p_coins_added,
        p_amount_paid,
        COALESCE(p_currency, 'usd'),
        p_receipt_token,
        p_platform,
        p_transaction_id,
        'completed'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_purchase_id;

    IF v_purchase_id IS NULL THEN
        RETURN jsonb_build_object('status', 'duplicate');
    END IF;

    UPDATE public.users
    SET coins_balance = coins_balance + p_coins_added
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'status', 'settled',
        'purchase_id', v_purchase_id,
        'new_balance', v_balance
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pending_coin_purchase(
    p_purchase_id UUID,
    p_user_id UUID,
    p_transaction_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_coins INTEGER;
    v_balance INTEGER;
BEGIN
    UPDATE public.coin_purchases
    SET status = 'completed',
        transaction_id = COALESCE(NULLIF(btrim(p_transaction_id), ''), transaction_id)
    WHERE id = p_purchase_id
      AND user_id = p_user_id
      AND status = 'pending'
    RETURNING coins_added INTO v_coins;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'not_pending');
    END IF;

    UPDATE public.users
    SET coins_balance = coins_balance + v_coins
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
    END IF;

    RETURN jsonb_build_object(
        'status', 'settled',
        'new_balance', v_balance
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfil_coin_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_pending_coin_purchase(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfil_coin_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_pending_coin_purchase(UUID, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.fulfil_coin_purchase(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT) IS
    'Atomically records a verified store purchase and credits the user balance.';
COMMENT ON FUNCTION public.complete_pending_coin_purchase(UUID, UUID, TEXT) IS
    'Atomically finalises a pending web checkout and credits the user balance.';
