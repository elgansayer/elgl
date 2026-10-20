-- Harden scheduled Event -> Language Party creation for #1331.
--
-- The application worker derives a deterministic room name from the event id.
-- These database invariants make that retry-safe across replicas and preserve a
-- durable back-reference from the generated Language Party to its source event.

-- Historical builds allowed event_id without a foreign key. Clear references to
-- events that no longer exist before adding the relationship constraint.
UPDATE public.audio_rooms ar
SET event_id = NULL
WHERE ar.event_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = ar.event_id
  );

-- If an earlier race created duplicate event links, keep the deterministic room
-- when one exists; otherwise keep the oldest room and detach the rest. Rooms are
-- not deleted because they may contain recordings/transcripts that must remain
-- subject to their normal retention lifecycle.
WITH ranked AS (
  SELECT
    ar.id,
    ar.event_id,
    ROW_NUMBER() OVER (
      PARTITION BY ar.event_id
      ORDER BY
        (ar.room_name = 'language_party-' || ar.event_id::text) DESC,
        ar.created_at ASC,
        ar.id ASC
    ) AS row_number
  FROM public.audio_rooms ar
  WHERE ar.event_id IS NOT NULL
)
UPDATE public.audio_rooms ar
SET event_id = NULL
FROM ranked r
WHERE ar.id = r.id
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS audio_rooms_event_id_unique
  ON public.audio_rooms (event_id)
  WHERE event_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audio_rooms_event_id_fkey'
      AND conrelid = 'public.audio_rooms'::regclass
  ) THEN
    ALTER TABLE public.audio_rooms
      ADD CONSTRAINT audio_rooms_event_id_fkey
      FOREIGN KEY (event_id)
      REFERENCES public.events(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.audio_rooms
  VALIDATE CONSTRAINT audio_rooms_event_id_fkey;

-- The worker only scans a small recent time window of due, non-cancelled audio
-- events. This partial index avoids a growing full-table scan as event history
-- accumulates.
CREATE INDEX IF NOT EXISTS events_due_audio_room_idx
  ON public.events (date_time ASC, id ASC)
  WHERE category = 'audio_room'
    AND is_cancelled = false
    AND language_pair IS NOT NULL;

COMMENT ON INDEX public.audio_rooms_event_id_unique IS
  'Guarantees at most one generated audio room per scheduled event across worker replicas.';

COMMENT ON INDEX public.events_due_audio_room_idx IS
  'Supports bounded scheduled Language Party scans for due non-cancelled audio-room events.';
