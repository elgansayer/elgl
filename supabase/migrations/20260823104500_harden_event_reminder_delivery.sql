-- Harden event reminder delivery for #1329.
--
-- Existing application versions insert into event_reminders_sent only after a
-- dispatch attempt. Keep that behavior compatible while adding a leased,
-- service-role-only claim path for newer workers.

ALTER TABLE public.event_reminders_sent
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'sent',
    ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.event_reminders_sent
    ALTER COLUMN sent_at DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_reminders_sent_status_check'
          AND conrelid = 'public.event_reminders_sent'::regclass
    ) THEN
        ALTER TABLE public.event_reminders_sent
            ADD CONSTRAINT event_reminders_sent_status_check
            CHECK (status IN ('pending', 'sent'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'event_reminders_sent_attempt_count_check'
          AND conrelid = 'public.event_reminders_sent'::regclass
    ) THEN
        ALTER TABLE public.event_reminders_sent
            ADD CONSTRAINT event_reminders_sent_attempt_count_check
            CHECK (attempt_count >= 0 AND attempt_count <= 100);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS event_reminders_pending_idx
    ON public.event_reminders_sent (next_attempt_at, claimed_at)
    WHERE status = 'pending';

-- The original policy was created without a role clause, which made the
-- bookkeeping table writable through ordinary authenticated Supabase clients.
-- Reminder state is internal delivery metadata and must be backend-only.
DROP POLICY IF EXISTS "Service can manage reminders" ON public.event_reminders_sent;
REVOKE ALL ON TABLE public.event_reminders_sent FROM anon, authenticated;

-- Atomically discover and lease due reminders. This is deliberately a single
-- bounded RPC so multiple NestJS replicas cannot race between SELECT and INSERT
-- and produce duplicate pushes.
CREATE OR REPLACE FUNCTION public.claim_due_event_reminders(
    p_now TIMESTAMPTZ DEFAULT now(),
    p_limit INTEGER DEFAULT 200,
    p_lease_seconds INTEGER DEFAULT 120
)
RETURNS TABLE (
    reminder_id UUID,
    event_id UUID,
    user_id UUID,
    event_title TEXT,
    event_date_time TIMESTAMPTZ,
    attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
    v_lease_seconds INTEGER := LEAST(
        GREATEST(COALESCE(p_lease_seconds, 120), 30),
        600
    );
BEGIN
    -- Populate pending work for all attending users whose non-cancelled event
    -- starts within the next 15 minutes. Existing sent/pending rows are kept,
    -- preserving exactly one durable reminder record per event/user pair.
    INSERT INTO public.event_reminders_sent (
        event_id,
        user_id,
        status,
        sent_at,
        claimed_at,
        next_attempt_at,
        attempt_count,
        updated_at
    )
    SELECT
        e.id,
        r.user_id,
        'pending',
        NULL,
        NULL,
        p_now,
        0,
        p_now
    FROM public.events e
    JOIN public.event_rsvps r
      ON r.event_id = e.id
     AND r.status = 'attending'
    WHERE e.is_cancelled = false
      AND e.date_time > p_now
      AND e.date_time <= p_now + INTERVAL '15 minutes'
    ON CONFLICT (event_id, user_id) DO NOTHING;

    RETURN QUERY
    WITH due AS (
        SELECT ers.id
        FROM public.event_reminders_sent ers
        JOIN public.events e
          ON e.id = ers.event_id
        JOIN public.event_rsvps r
          ON r.event_id = ers.event_id
         AND r.user_id = ers.user_id
         AND r.status = 'attending'
        WHERE ers.status = 'pending'
          AND COALESCE(ers.next_attempt_at, p_now) <= p_now
          AND (
              ers.claimed_at IS NULL
              OR ers.claimed_at <= p_now - make_interval(secs => v_lease_seconds)
          )
          AND e.is_cancelled = false
          AND e.date_time > p_now
          AND e.date_time <= p_now + INTERVAL '15 minutes'
        ORDER BY e.date_time ASC, ers.id ASC
        FOR UPDATE OF ers SKIP LOCKED
        LIMIT v_limit
    ), claimed AS (
        UPDATE public.event_reminders_sent ers
        SET claimed_at = p_now,
            attempt_count = ers.attempt_count + 1,
            updated_at = p_now
        FROM due
        WHERE ers.id = due.id
        RETURNING ers.id, ers.event_id, ers.user_id, ers.attempt_count
    )
    SELECT
        c.id,
        c.event_id,
        c.user_id,
        e.title,
        e.date_time,
        c.attempt_count
    FROM claimed c
    JOIN public.events e ON e.id = c.event_id
    ORDER BY e.date_time ASC, c.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_event_reminders(TIMESTAMPTZ, INTEGER, INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_event_reminders(TIMESTAMPTZ, INTEGER, INTEGER)
    TO service_role;

COMMENT ON FUNCTION public.claim_due_event_reminders(TIMESTAMPTZ, INTEGER, INTEGER)
IS 'Atomically creates and leases bounded 15-minute event reminder deliveries for service-role workers.';

COMMENT ON TABLE public.event_reminders_sent
IS 'Backend-only event reminder delivery state. One row per event/user, retained with the event and removed by ON DELETE CASCADE.';