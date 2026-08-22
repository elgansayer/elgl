-- Production-safe daily/weekly quests with atomic, at-most-once coin rewards.
-- Daily periods reset at 00:00 UTC. Weekly periods reset Monday 00:00 UTC.

CREATE TABLE IF NOT EXISTS public.user_quests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    quest_type TEXT NOT NULL,
    quest_key TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    target INTEGER NOT NULL,
    reward_coins INTEGER NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_quests
    ADD COLUMN IF NOT EXISTS period_start DATE,
    ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ;

-- Converge any legacy rows before adding stricter invariants.
UPDATE public.user_quests
SET quest_type = CASE WHEN quest_type = 'weekly' THEN 'weekly' ELSE 'daily' END,
    progress = GREATEST(COALESCE(progress, 0), 0),
    target = GREATEST(COALESCE(target, 1), 1),
    reward_coins = GREATEST(COALESCE(reward_coins, 0), 0),
    completed = COALESCE(completed, false),
    period_start = COALESCE(
        period_start,
        CASE
            WHEN quest_type = 'weekly' THEN date_trunc('week', COALESCE(updated_at, now()) AT TIME ZONE 'UTC')::date
            ELSE (COALESCE(updated_at, now()) AT TIME ZONE 'UTC')::date
        END
    ),
    reward_claimed_at = CASE
        WHEN COALESCE(completed, false) THEN COALESCE(reward_claimed_at, updated_at, now())
        ELSE NULL
    END,
    updated_at = COALESCE(updated_at, now()),
    created_at = COALESCE(created_at, now());

-- Legacy application code could race while creating defaults. Keep the most
-- advanced row and remove duplicates before enforcing uniqueness.
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY user_id, quest_type, quest_key
               ORDER BY completed DESC, progress DESC, updated_at DESC, created_at DESC, id
           ) AS rn
    FROM public.user_quests
)
DELETE FROM public.user_quests q
USING ranked r
WHERE q.id = r.id
  AND r.rn > 1;

ALTER TABLE public.user_quests
    ALTER COLUMN period_start SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_quests_type_check'
          AND conrelid = 'public.user_quests'::regclass
    ) THEN
        ALTER TABLE public.user_quests
            ADD CONSTRAINT user_quests_type_check
            CHECK (quest_type IN ('daily', 'weekly'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_quests_progress_check'
          AND conrelid = 'public.user_quests'::regclass
    ) THEN
        ALTER TABLE public.user_quests
            ADD CONSTRAINT user_quests_progress_check CHECK (progress >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_quests_target_check'
          AND conrelid = 'public.user_quests'::regclass
    ) THEN
        ALTER TABLE public.user_quests
            ADD CONSTRAINT user_quests_target_check CHECK (target > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_quests_reward_check'
          AND conrelid = 'public.user_quests'::regclass
    ) THEN
        ALTER TABLE public.user_quests
            ADD CONSTRAINT user_quests_reward_check CHECK (reward_coins BETWEEN 0 AND 10000);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_quests_user_type_key_uidx
    ON public.user_quests (user_id, quest_type, quest_key);
CREATE INDEX IF NOT EXISTS user_quests_user_period_idx
    ON public.user_quests (user_id, period_start, quest_type);

ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_quests_select_own ON public.user_quests;
CREATE POLICY user_quests_select_own ON public.user_quests
    FOR SELECT
    USING (auth.uid() = user_id);

GRANT SELECT ON public.user_quests TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_quests FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_user_quests(p_user_id UUID)
RETURNS SETOF public.user_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := (now() AT TIME ZONE 'UTC')::date;
    v_week DATE := date_trunc('week', now() AT TIME ZONE 'UTC')::date;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;

    INSERT INTO public.user_quests (
        user_id, quest_type, quest_key, progress, target, reward_coins,
        completed, period_start, reward_claimed_at, updated_at
    ) VALUES
        (p_user_id, 'daily', 'correct_moments', 0, 3, 5, false, v_today, NULL, now()),
        (p_user_id, 'daily', 'post_moment', 0, 1, 5, false, v_today, NULL, now()),
        (p_user_id, 'weekly', 'correct_moments', 0, 10, 20, false, v_week, NULL, now())
    ON CONFLICT (user_id, quest_type, quest_key) DO UPDATE
    SET target = EXCLUDED.target,
        reward_coins = EXCLUDED.reward_coins;

    UPDATE public.user_quests
    SET progress = 0,
        completed = false,
        reward_claimed_at = NULL,
        period_start = CASE WHEN quest_type = 'weekly' THEN v_week ELSE v_today END,
        updated_at = now()
    WHERE user_id = p_user_id
      AND period_start <> CASE WHEN quest_type = 'weekly' THEN v_week ELSE v_today END;

    RETURN QUERY
    SELECT q.*
    FROM public.user_quests q
    WHERE q.user_id = p_user_id
    ORDER BY CASE q.quest_type WHEN 'daily' THEN 0 ELSE 1 END,
             q.quest_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_user_quests(
    p_user_id UUID,
    p_quest_key TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (
    quest_id UUID,
    quest_type TEXT,
    quest_key TEXT,
    progress INTEGER,
    target INTEGER,
    reward_coins INTEGER,
    completed BOOLEAN,
    reward_awarded BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quest public.user_quests%ROWTYPE;
    v_progress INTEGER;
    v_award BOOLEAN;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user id is required';
    END IF;
    IF p_quest_key NOT IN ('correct_moments', 'post_moment') THEN
        RAISE EXCEPTION 'unknown quest key';
    END IF;
    IF p_amount IS NULL OR p_amount < 1 OR p_amount > 100 THEN
        RAISE EXCEPTION 'amount must be between 1 and 100';
    END IF;

    -- Ensures defaults exist and period rollover happens before rows are locked.
    PERFORM public.get_or_create_user_quests(p_user_id);

    FOR v_quest IN
        SELECT *
        FROM public.user_quests q
        WHERE q.user_id = p_user_id
          AND q.quest_key = p_quest_key
        ORDER BY q.quest_type
        FOR UPDATE
    LOOP
        v_progress := LEAST(v_quest.target, v_quest.progress + p_amount);
        v_award := NOT v_quest.completed
                   AND v_progress >= v_quest.target
                   AND v_quest.reward_claimed_at IS NULL;

        UPDATE public.user_quests
        SET progress = v_progress,
            completed = (v_progress >= v_quest.target),
            reward_claimed_at = CASE WHEN v_award THEN now() ELSE reward_claimed_at END,
            updated_at = now()
        WHERE id = v_quest.id;

        IF v_award AND v_quest.reward_coins > 0 THEN
            PERFORM public.add_user_coins(p_user_id, v_quest.reward_coins);
            INSERT INTO public.coin_transactions (
                user_id, type, amount, description, metadata
            ) VALUES (
                p_user_id,
                'quest_reward',
                v_quest.reward_coins,
                'Quest completion reward',
                jsonb_build_object(
                    'quest_id', v_quest.id,
                    'quest_type', v_quest.quest_type,
                    'quest_key', v_quest.quest_key,
                    'period_start', v_quest.period_start
                )
            );
        END IF;

        quest_id := v_quest.id;
        quest_type := v_quest.quest_type;
        quest_key := v_quest.quest_key;
        progress := v_progress;
        target := v_quest.target;
        reward_coins := v_quest.reward_coins;
        completed := (v_progress >= v_quest.target);
        reward_awarded := v_award;
        RETURN NEXT;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_user_quests(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_user_quests(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_quests(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_user_quests(UUID, TEXT, INTEGER) TO service_role;
