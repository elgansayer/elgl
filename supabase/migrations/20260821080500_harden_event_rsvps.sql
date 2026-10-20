-- Harden event RSVP mutations for #855.
--
-- The event row is locked before every RSVP mutation so concurrent requests for
-- the final Attending slot are serialized. Interested RSVPs never consume
-- capacity, and switching from Attending to Interested releases a slot as soon
-- as the transaction commits.

CREATE OR REPLACE FUNCTION public.enforce_event_rsvp_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_event_id UUID;
    event_max_participants INTEGER;
    event_date_time TIMESTAMPTZ;
    event_is_cancelled BOOLEAN;
    attending_count BIGINT;
BEGIN
    target_event_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.event_id ELSE NEW.event_id END;

    SELECT max_participants, date_time, is_cancelled
      INTO event_max_participants, event_date_time, event_is_cancelled
      FROM public.events
     WHERE id = target_event_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'event_not_found';
    END IF;

    IF event_is_cancelled THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'event_cancelled';
    END IF;

    IF event_date_time <= now() THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'event_started';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    NEW.updated_at := now();

    IF NEW.status = 'attending'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'attending')
       AND event_max_participants IS NOT NULL THEN
        IF TG_OP = 'UPDATE' THEN
            SELECT count(*)
              INTO attending_count
              FROM public.event_rsvps
             WHERE event_id = NEW.event_id
               AND status = 'attending'
               AND id <> OLD.id;
        ELSE
            SELECT count(*)
              INTO attending_count
              FROM public.event_rsvps
             WHERE event_id = NEW.event_id
               AND status = 'attending';
        END IF;

        IF attending_count >= event_max_participants THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P0001',
                MESSAGE = 'event_full';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_enforce_mutation ON public.event_rsvps;
CREATE TRIGGER event_rsvps_enforce_mutation
BEFORE INSERT OR UPDATE OF status OR DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_event_rsvp_mutation();

-- Return aggregate RSVP data for a bounded set of event cards without exposing
-- attendee identities or forcing the client into an N+1 request pattern.
CREATE OR REPLACE FUNCTION public.get_event_rsvp_summaries(
    p_user_id UUID,
    p_event_ids UUID[]
)
RETURNS TABLE (
    event_id UUID,
    attending_count BIGINT,
    interested_count BIGINT,
    viewer_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        e.id AS event_id,
        count(r.id) FILTER (WHERE r.status = 'attending') AS attending_count,
        count(r.id) FILTER (WHERE r.status = 'interested') AS interested_count,
        max(r.status) FILTER (WHERE r.user_id = p_user_id) AS viewer_status
    FROM public.events AS e
    LEFT JOIN public.event_rsvps AS r ON r.event_id = e.id
    WHERE e.id = ANY(p_event_ids)
    GROUP BY e.id;
$$;

REVOKE ALL ON FUNCTION public.get_event_rsvp_summaries(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_event_rsvp_summaries(UUID, UUID[]) TO service_role;

COMMENT ON FUNCTION public.enforce_event_rsvp_mutation() IS
'Validates RSVP mutability and serializes Attending capacity checks per event.';
COMMENT ON FUNCTION public.get_event_rsvp_summaries(UUID, UUID[]) IS
'Returns aggregate RSVP counts plus the supplied viewer RSVP state without attendee identities.';
