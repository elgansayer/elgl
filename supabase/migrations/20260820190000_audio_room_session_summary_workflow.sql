-- Durable, privacy-scoped AI session summaries for archived audio rooms.
--
-- Summary generation is intentionally stateful so archiving a room never has to
-- wait for speech-to-text or an LLM. The backend transitions rows through
-- pending -> processing -> ready/failed and retries transient failures.

ALTER TABLE public.audio_room_transcripts
  ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS summary_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS summary_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary_next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS summary_error_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audio_room_transcripts_summary_status_check'
      AND conrelid = 'public.audio_room_transcripts'::regclass
  ) THEN
    ALTER TABLE public.audio_room_transcripts
      ADD CONSTRAINT audio_room_transcripts_summary_status_check
      CHECK (summary_status IN ('pending', 'processing', 'ready', 'failed'));
  END IF;
END $$;

-- Older installations did not enforce one transcript row per room. Preserve the
-- newest row before adding the unique index so migration replay cannot fail on
-- historical duplicate archive callbacks.
DELETE FROM public.audio_room_transcripts older
USING public.audio_room_transcripts newer
WHERE older.room_id = newer.room_id
  AND (
    older.created_at < newer.created_at
    OR (older.created_at = newer.created_at AND older.id < newer.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS audio_room_transcripts_room_id_unique
  ON public.audio_room_transcripts (room_id);

CREATE INDEX IF NOT EXISTS audio_room_transcripts_summary_queue_idx
  ON public.audio_room_transcripts (summary_status, summary_next_retry_at, updated_at)
  WHERE summary_status IN ('pending', 'processing', 'failed');

-- Persist actual room participation. This closes the historical privacy gap
-- where every authenticated account could select every transcript via RLS.
CREATE TABLE IF NOT EXISTS public.audio_room_participants (
  room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS audio_room_participants_user_joined_idx
  ON public.audio_room_participants (user_id, joined_at DESC);

ALTER TABLE public.audio_room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own audio room participation"
  ON public.audio_room_participants;
CREATE POLICY "Users can view own audio room participation"
  ON public.audio_room_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Participation rows are written by the service-role backend after the user has
-- authenticated and joined a room. Direct client writes remain blocked.
DROP POLICY IF EXISTS "Users can insert own audio room participation"
  ON public.audio_room_participants;
DROP POLICY IF EXISTS "Users can update own audio room participation"
  ON public.audio_room_participants;
DROP POLICY IF EXISTS "Users can delete own audio room participation"
  ON public.audio_room_participants;

ALTER TABLE public.audio_room_transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can view transcripts"
  ON public.audio_room_transcripts;
DROP POLICY IF EXISTS "Room participants can view transcripts"
  ON public.audio_room_transcripts;

CREATE POLICY "Room participants can view transcripts"
  ON public.audio_room_transcripts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.audio_rooms room
      WHERE room.id = audio_room_transcripts.room_id
        AND (
          room.host_id = auth.uid()
          OR room.co_host_id = auth.uid()
          OR auth.uid() = ANY(COALESCE(room.speakers, ARRAY[]::UUID[]))
          OR auth.uid() = ANY(COALESCE(room.invited_user_ids, ARRAY[]::UUID[]))
          OR EXISTS (
            SELECT 1
            FROM public.audio_room_participants participant
            WHERE participant.room_id = room.id
              AND participant.user_id = auth.uid()
          )
        )
    )
  );

-- The product historically uses both is_active and is_archived. Make their
-- archive transition consistent regardless of whether an old or new backend
-- path ends the room.
CREATE OR REPLACE FUNCTION public.sync_audio_room_archived_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
    NEW.is_archived := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_audio_room_archived_state ON public.audio_rooms;
CREATE TRIGGER trg_sync_audio_room_archived_state
BEFORE UPDATE OF is_active ON public.audio_rooms
FOR EACH ROW
EXECUTE FUNCTION public.sync_audio_room_archived_state();

-- Account deletion in this application is a soft-delete. Purge archive-derived
-- learning data hosted by that account and revoke that user's participation as
-- soon as is_deleted transitions to true. Room deletion already cascades the
-- transcript and participation rows through their foreign keys.
CREATE OR REPLACE FUNCTION public.purge_audio_room_archive_data_on_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted = TRUE AND COALESCE(OLD.is_deleted, FALSE) = FALSE THEN
    DELETE FROM public.audio_room_transcripts transcript
    USING public.audio_rooms room
    WHERE transcript.room_id = room.id
      AND room.host_id = NEW.id;

    DELETE FROM public.audio_room_participants
    WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purge_audio_room_archive_data_on_user_delete
  ON public.users;
CREATE TRIGGER trg_purge_audio_room_archive_data_on_user_delete
AFTER UPDATE OF is_deleted ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.purge_audio_room_archive_data_on_user_delete();

COMMENT ON COLUMN public.audio_room_transcripts.summary_status IS
  'Durable AI summary job state: pending, processing, ready, or failed.';
COMMENT ON COLUMN public.audio_room_transcripts.summary_error_code IS
  'Non-sensitive machine-readable failure category. Never stores transcript or provider response content.';
COMMENT ON TABLE public.audio_room_participants IS
  'Authenticated room participation used to authorise archived recordings, transcripts, and AI summaries.';
