-- Prevent an authenticated client from manufacturing archive access after a
-- public room has already ended. Participation is recorded while the live room
-- is active. The host is the only exception because finalisation upserts host
-- participation after transitioning the room to inactive.

CREATE OR REPLACE FUNCTION public.guard_audio_room_participation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_active BOOLEAN;
  room_host UUID;
BEGIN
  SELECT is_active, host_id
  INTO room_active, room_host
  FROM public.audio_rooms
  WHERE id = NEW.room_id;

  IF room_host IS NULL THEN
    RAISE EXCEPTION 'audio room not found';
  END IF;

  IF room_active = FALSE AND NEW.user_id <> room_host THEN
    RAISE EXCEPTION 'cannot record new participation for an archived audio room';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_audio_room_participation_insert
  ON public.audio_room_participants;
CREATE TRIGGER trg_guard_audio_room_participation_insert
BEFORE INSERT ON public.audio_room_participants
FOR EACH ROW
EXECUTE FUNCTION public.guard_audio_room_participation_insert();
