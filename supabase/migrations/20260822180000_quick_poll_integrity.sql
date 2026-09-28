-- Quick-poll integrity hardening for #1147.
--
-- The NestJS backend uses the Supabase service role, which bypasses RLS. Keep
-- the RLS policies for defence in depth, but also enforce the host boundary in
-- a database trigger so service-role writes cannot create polls on behalf of a
-- non-host caller.

CREATE OR REPLACE FUNCTION public.enforce_quick_poll_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    room_host_id UUID;
    normalised_options TEXT[];
BEGIN
    SELECT ar.host_id
      INTO room_host_id
      FROM public.audio_rooms AS ar
     WHERE ar.id = NEW.room_id;

    IF room_host_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Audio room not found for quick poll';
    END IF;

    IF NEW.host_id IS DISTINCT FROM room_host_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Only the audio room host may create a quick poll';
    END IF;

    NEW.question := btrim(NEW.question);
    normalised_options := ARRAY(
        SELECT btrim(option_text)
          FROM unnest(NEW.options) AS option_text
    );

    IF NEW.question = '' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Quick poll question cannot be blank';
    END IF;

    IF cardinality(normalised_options) < 2 OR cardinality(normalised_options) > 6 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Quick polls require between two and six options';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM unnest(normalised_options) AS option_text
         WHERE option_text = '' OR char_length(option_text) > 100
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Quick poll options must contain between 1 and 100 characters';
    END IF;

    IF EXISTS (
        SELECT lower(option_text)
          FROM unnest(normalised_options) AS option_text
         GROUP BY lower(option_text)
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Quick poll options must be unique';
    END IF;

    NEW.options := normalised_options;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quick_polls_enforce_integrity ON public.quick_polls;
CREATE TRIGGER quick_polls_enforce_integrity
    BEFORE INSERT OR UPDATE OF room_id, host_id, question, options
    ON public.quick_polls
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_quick_poll_integrity();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'quick_polls_question_length'
           AND conrelid = 'public.quick_polls'::regclass
    ) THEN
        ALTER TABLE public.quick_polls
            ADD CONSTRAINT quick_polls_question_length
            CHECK (char_length(btrim(question)) BETWEEN 1 AND 300) NOT VALID;
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'quick_polls_option_count'
           AND conrelid = 'public.quick_polls'::regclass
    ) THEN
        ALTER TABLE public.quick_polls
            ADD CONSTRAINT quick_polls_option_count
            CHECK (cardinality(options) BETWEEN 2 AND 6) NOT VALID;
    END IF;
END
$$;

-- Direct authenticated clients must be both the declared host and the actual
-- host of the room. The service-role backend is protected by the trigger above.
DROP POLICY IF EXISTS quick_polls_insert_own ON public.quick_polls;
CREATE POLICY quick_polls_insert_own ON public.quick_polls
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = host_id
        AND EXISTS (
            SELECT 1
              FROM public.audio_rooms AS ar
             WHERE ar.id = quick_polls.room_id
               AND ar.host_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS quick_polls_update_own ON public.quick_polls;
CREATE POLICY quick_polls_update_own ON public.quick_polls
    FOR UPDATE TO authenticated USING (
        auth.uid() = host_id
        AND EXISTS (
            SELECT 1
              FROM public.audio_rooms AS ar
             WHERE ar.id = quick_polls.room_id
               AND ar.host_id = auth.uid()
        )
    ) WITH CHECK (
        auth.uid() = host_id
        AND EXISTS (
            SELECT 1
              FROM public.audio_rooms AS ar
             WHERE ar.id = quick_polls.room_id
               AND ar.host_id = auth.uid()
        )
    );
