-- Production contract for coin-funded language challenges.
--
-- The NestJS API uses the service-role client. Browser clients may read public
-- challenge metadata and their own participation/activity rows, but all writes
-- and economy mutations are kept behind backend-only RPCs.

CREATE TABLE IF NOT EXISTS public.language_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    entry_fee_coins INTEGER NOT NULL DEFAULT 1,
    duration_days INTEGER NOT NULL DEFAULT 7,
    challenge_type VARCHAR(32) NOT NULL DEFAULT 'streak',
    prize_pool_coins INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.language_challenges
    ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.language_challenges
SET ends_at = COALESCE(ends_at, starts_at + make_interval(days => duration_days))
WHERE ends_at IS NULL;

ALTER TABLE public.language_challenges
    ALTER COLUMN ends_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'language_challenges_entry_fee_bounds'
    ) THEN
        ALTER TABLE public.language_challenges
            ADD CONSTRAINT language_challenges_entry_fee_bounds
            CHECK (entry_fee_coins BETWEEN 1 AND 1000) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'language_challenges_duration_bounds'
    ) THEN
        ALTER TABLE public.language_challenges
            ADD CONSTRAINT language_challenges_duration_bounds
            CHECK (duration_days BETWEEN 1 AND 30) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'language_challenges_type_valid'
    ) THEN
        ALTER TABLE public.language_challenges
            ADD CONSTRAINT language_challenges_type_valid
            CHECK (challenge_type IN ('streak', 'points')) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'language_challenges_status_valid'
    ) THEN
        ALTER TABLE public.language_challenges
            ADD CONSTRAINT language_challenges_status_valid
            CHECK (status IN ('open', 'completed', 'cancelled')) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'language_challenges_time_order'
    ) THEN
        ALTER TABLE public.language_challenges
            ADD CONSTRAINT language_challenges_time_order
            CHECK (ends_at > starts_at) NOT VALID;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.language_challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES public.language_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    prize_coins INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    UNIQUE (challenge_id, user_id),
    CHECK (status IN ('active', 'completed', 'failed')),
    CHECK (prize_coins >= 0)
);

ALTER TABLE public.language_challenge_participants
    ADD COLUMN IF NOT EXISTS prize_coins INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.language_challenge_daily_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES public.language_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (challenge_id, user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS language_challenges_status_end_idx
    ON public.language_challenges (status, ends_at, created_at DESC);
CREATE INDEX IF NOT EXISTS language_challenge_participants_challenge_idx
    ON public.language_challenge_participants (challenge_id, status);
CREATE INDEX IF NOT EXISTS language_challenge_participants_user_idx
    ON public.language_challenge_participants (user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS language_challenge_activity_progress_idx
    ON public.language_challenge_daily_activity (challenge_id, user_id, activity_date);

ALTER TABLE public.language_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.language_challenge_daily_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS language_challenges_select_authenticated ON public.language_challenges;
CREATE POLICY language_challenges_select_authenticated ON public.language_challenges
    FOR SELECT TO authenticated
    USING (status <> 'cancelled');

DROP POLICY IF EXISTS language_challenge_participants_select_own ON public.language_challenge_participants;
CREATE POLICY language_challenge_participants_select_own ON public.language_challenge_participants
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS language_challenge_activity_select_own ON public.language_challenge_daily_activity;
CREATE POLICY language_challenge_activity_select_own ON public.language_challenge_daily_activity
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Atomic join: row locks + the participant uniqueness constraint make retries
-- idempotent and prevent a user from being charged twice under concurrency.
CREATE OR REPLACE FUNCTION public.join_language_challenge(
    p_challenge_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge public.language_challenges%ROWTYPE;
    v_balance INTEGER;
    v_existing UUID;
    v_pool INTEGER;
BEGIN
    SELECT * INTO v_challenge
    FROM public.language_challenges
    WHERE id = p_challenge_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'challenge_not_found';
    END IF;
    IF v_challenge.status <> 'open' OR now() >= v_challenge.ends_at THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_not_open';
    END IF;

    SELECT id INTO v_existing
    FROM public.language_challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    IF v_existing IS NOT NULL THEN
        SELECT coins_balance INTO v_balance FROM public.users WHERE id = p_user_id;
        RETURN jsonb_build_object(
            'joined', true,
            'alreadyJoined', true,
            'coinsRemaining', COALESCE(v_balance, 0),
            'prizePoolCoins', v_challenge.prize_pool_coins
        );
    END IF;

    SELECT coins_balance INTO v_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'user_not_found';
    END IF;
    IF v_balance < v_challenge.entry_fee_coins THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'insufficient_coins';
    END IF;

    UPDATE public.users
    SET coins_balance = coins_balance - v_challenge.entry_fee_coins
    WHERE id = p_user_id
    RETURNING coins_balance INTO v_balance;

    INSERT INTO public.language_challenge_participants (challenge_id, user_id, status)
    VALUES (p_challenge_id, p_user_id, 'active');

    UPDATE public.language_challenges
    SET prize_pool_coins = prize_pool_coins + v_challenge.entry_fee_coins
    WHERE id = p_challenge_id
    RETURNING prize_pool_coins INTO v_pool;

    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata)
    VALUES (
        p_user_id,
        'challenge_entry',
        -v_challenge.entry_fee_coins,
        'Language challenge entry fee',
        jsonb_build_object('challenge_id', p_challenge_id)
    );

    RETURN jsonb_build_object(
        'joined', true,
        'alreadyJoined', false,
        'coinsRemaining', v_balance,
        'prizePoolCoins', v_pool
    );
END;
$$;

-- A daily check-in is deliberately idempotent. UTC defines challenge days so
-- clients cannot gain extra progress by changing their device timezone.
CREATE OR REPLACE FUNCTION public.checkin_language_challenge(
    p_challenge_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge public.language_challenges%ROWTYPE;
    v_activity_date DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_inserted INTEGER;
    v_progress INTEGER;
BEGIN
    SELECT * INTO v_challenge
    FROM public.language_challenges
    WHERE id = p_challenge_id
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'challenge_not_found';
    END IF;
    IF v_challenge.status <> 'open' OR now() < v_challenge.starts_at OR now() >= v_challenge.ends_at THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_not_active';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.language_challenge_participants
        WHERE challenge_id = p_challenge_id AND user_id = p_user_id AND status = 'active'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_not_joined';
    END IF;

    INSERT INTO public.language_challenge_daily_activity (challenge_id, user_id, activity_date)
    VALUES (p_challenge_id, p_user_id, v_activity_date)
    ON CONFLICT (challenge_id, user_id, activity_date) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;

    SELECT count(DISTINCT activity_date)::INTEGER INTO v_progress
    FROM public.language_challenge_daily_activity
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    RETURN jsonb_build_object(
        'checkedIn', true,
        'alreadyCheckedIn', v_inserted = 0,
        'progressDays', v_progress,
        'targetDays', v_challenge.duration_days,
        'activityDate', v_activity_date
    );
END;
$$;

-- The first eligible claim after the deadline settles the whole challenge in
-- one transaction. Every completer is paid at most once; later calls only read
-- the persisted result. Remainder coins stay on the completed challenge as an
-- explicit, auditable remainder rather than being silently minted or lost.
CREATE OR REPLACE FUNCTION public.claim_language_challenge_prize(
    p_challenge_id UUID,
    p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_challenge public.language_challenges%ROWTYPE;
    v_progress INTEGER;
    v_winners INTEGER;
    v_share INTEGER;
    v_remainder INTEGER;
    v_prize INTEGER;
BEGIN
    SELECT * INTO v_challenge
    FROM public.language_challenges
    WHERE id = p_challenge_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'challenge_not_found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.language_challenge_participants
        WHERE challenge_id = p_challenge_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_not_joined';
    END IF;

    IF v_challenge.status = 'completed' THEN
        SELECT prize_coins INTO v_prize
        FROM public.language_challenge_participants
        WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
        IF COALESCE(v_prize, 0) <= 0 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_incomplete';
        END IF;
        RETURN jsonb_build_object('claimed', true, 'alreadySettled', true, 'prizeCoins', v_prize);
    END IF;

    IF v_challenge.status <> 'open' OR now() < v_challenge.ends_at THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_still_running';
    END IF;

    SELECT count(DISTINCT activity_date)::INTEGER INTO v_progress
    FROM public.language_challenge_daily_activity
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    IF v_progress < v_challenge.duration_days THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_incomplete';
    END IF;

    WITH progress AS (
        SELECT p.user_id, count(DISTINCT a.activity_date)::INTEGER AS days
        FROM public.language_challenge_participants p
        LEFT JOIN public.language_challenge_daily_activity a
          ON a.challenge_id = p.challenge_id AND a.user_id = p.user_id
        WHERE p.challenge_id = p_challenge_id
        GROUP BY p.user_id
    )
    SELECT count(*)::INTEGER INTO v_winners
    FROM progress
    WHERE days >= v_challenge.duration_days;

    IF v_winners <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'challenge_no_winners';
    END IF;

    v_share := floor(v_challenge.prize_pool_coins::NUMERIC / v_winners)::INTEGER;
    v_remainder := v_challenge.prize_pool_coins - (v_share * v_winners);

    WITH winners AS (
        SELECT p.user_id
        FROM public.language_challenge_participants p
        JOIN public.language_challenge_daily_activity a
          ON a.challenge_id = p.challenge_id AND a.user_id = p.user_id
        WHERE p.challenge_id = p_challenge_id
        GROUP BY p.user_id
        HAVING count(DISTINCT a.activity_date) >= v_challenge.duration_days
    )
    UPDATE public.users u
    SET coins_balance = u.coins_balance + v_share
    FROM winners w
    WHERE u.id = w.user_id;

    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata)
    SELECT
        p.user_id,
        'challenge_prize',
        v_share,
        'Language challenge prize',
        jsonb_build_object('challenge_id', p_challenge_id)
    FROM public.language_challenge_participants p
    JOIN public.language_challenge_daily_activity a
      ON a.challenge_id = p.challenge_id AND a.user_id = p.user_id
    WHERE p.challenge_id = p_challenge_id
    GROUP BY p.user_id
    HAVING count(DISTINCT a.activity_date) >= v_challenge.duration_days;

    WITH winner_ids AS (
        SELECT p.user_id
        FROM public.language_challenge_participants p
        JOIN public.language_challenge_daily_activity a
          ON a.challenge_id = p.challenge_id AND a.user_id = p.user_id
        WHERE p.challenge_id = p_challenge_id
        GROUP BY p.user_id
        HAVING count(DISTINCT a.activity_date) >= v_challenge.duration_days
    )
    UPDATE public.language_challenge_participants p
    SET status = CASE WHEN w.user_id IS NULL THEN 'failed' ELSE 'completed' END,
        prize_coins = CASE WHEN w.user_id IS NULL THEN 0 ELSE v_share END,
        claimed_at = CASE WHEN w.user_id IS NULL THEN NULL ELSE now() END
    FROM (SELECT user_id FROM public.language_challenge_participants WHERE challenge_id = p_challenge_id) all_p
    LEFT JOIN winner_ids w ON w.user_id = all_p.user_id
    WHERE p.challenge_id = p_challenge_id AND p.user_id = all_p.user_id;

    UPDATE public.language_challenges
    SET status = 'completed', completed_at = now(), prize_pool_coins = v_remainder
    WHERE id = p_challenge_id;

    SELECT prize_coins INTO v_prize
    FROM public.language_challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    RETURN jsonb_build_object(
        'claimed', true,
        'alreadySettled', false,
        'prizeCoins', COALESCE(v_prize, 0),
        'winnerCount', v_winners,
        'remainderCoins', v_remainder
    );
END;
$$;

-- Backend-only RPC execution. Direct table writes are intentionally not granted.
REVOKE ALL ON FUNCTION public.join_language_challenge(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkin_language_challenge(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_language_challenge_prize(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_language_challenge(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkin_language_challenge(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_language_challenge_prize(UUID, UUID) TO service_role;
