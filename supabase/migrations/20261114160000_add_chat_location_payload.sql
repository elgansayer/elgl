-- Persist a typed location payload on chat messages.
--
-- Latitude/longitude are metadata the sender chose to share; the payload stays
-- JSONB so live and static location messages share one column. Bounds are
-- enforced here as a second line of defence behind the DTO.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS location_payload JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_messages_location_payload_check'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_location_payload_check
      CHECK (
        location_payload IS NULL
        OR (
          jsonb_typeof(location_payload) = 'object'
          AND (location_payload->>'latitude')::numeric BETWEEN -90 AND 90
          AND (location_payload->>'longitude')::numeric BETWEEN -180 AND 180
        )
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.chat_messages.location_payload IS
  'Optional static or live location shared in a chat message.';
