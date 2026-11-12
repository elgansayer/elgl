-- Scheduled events: venue, map coordinates and dual-currency ticket metadata.
--
-- Prices are display/reservation metadata only. No payment or coin deduction is
-- performed by this migration or by the events API.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_type text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS ticket_price_gbp numeric(10, 2),
  ADD COLUMN IF NOT EXISTS ticket_price_usd numeric(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_venue_type_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_venue_type_check
      CHECK (
        venue_type IS NULL
        OR venue_type IN ('audio_room', 'zoom', 'in_person')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_coordinate_range_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_coordinate_range_check
      CHECK (
        (latitude IS NULL OR (latitude >= -90 AND latitude <= 90))
        AND (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
        AND ((latitude IS NULL) = (longitude IS NULL))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_ticket_price_range_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_ticket_price_range_check
      CHECK (
        (ticket_price_gbp IS NULL OR (ticket_price_gbp >= 0 AND ticket_price_gbp <= 100000))
        AND (ticket_price_usd IS NULL OR (ticket_price_usd >= 0 AND ticket_price_usd <= 100000))
      );
  END IF;
END
$$;

-- In-person events are map-rendered from coordinates, so keep the lookup cheap
-- without exposing a full event scan.
CREATE INDEX IF NOT EXISTS events_in_person_coordinates_idx
  ON public.events (date_time ASC)
  WHERE venue_type = 'in_person'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND is_cancelled = false;

COMMENT ON COLUMN public.events.ticket_price_gbp IS
  'Display/reservation ticket price in GBP. No payment is captured by the events API.';
COMMENT ON COLUMN public.events.ticket_price_usd IS
  'Display/reservation ticket price in USD. No payment is captured by the events API.';
COMMENT ON COLUMN public.events.latitude IS
  'Optional in-person venue latitude rendered as a map snippet.';
COMMENT ON COLUMN public.events.longitude IS
  'Optional in-person venue longitude rendered as a map snippet.';

-- Community groups can open a linked group chat. The legacy groups table is not
-- part of the replayable SQL corpus, so guard the change for clean replays.
DO $$
BEGIN
  IF to_regclass('public.groups') IS NOT NULL THEN
    ALTER TABLE public.groups
      ADD COLUMN IF NOT EXISTS chat_room_id uuid;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'groups_chat_room_id_fkey'
        AND conrelid = 'public.groups'::regclass
    ) THEN
      ALTER TABLE public.groups
        ADD CONSTRAINT groups_chat_room_id_fkey
        FOREIGN KEY (chat_room_id)
        REFERENCES public.chat_rooms(id)
        ON DELETE SET NULL;
    END IF;

    CREATE UNIQUE INDEX IF NOT EXISTS groups_chat_room_id_unique
      ON public.groups (chat_room_id)
      WHERE chat_room_id IS NOT NULL;
  END IF;
END
$$;
