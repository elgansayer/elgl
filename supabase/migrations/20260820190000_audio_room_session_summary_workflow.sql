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

-- The application has always treated room_id as one transcript/summary job per
-- room (all existing writes use ON CONFLICT(room_id)). Make that contract
-- explicit so duplicate archive callbacks are idempotent at the database layer.
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

COMMENT ON COLUMN public.audio_room_transcripts.summary_status IS
  'Durable AI summary job state: pending, processing, ready, or failed.';
COMMENT ON COLUMN public.audio_room_transcripts.summary_error_code IS
  'Non-sensitive machine-readable failure category. Never stores transcript or provider response content.';
COMMENT ON TABLE public.audio_room_participants IS
  'Authenticated room participation used to authorise archived recordings, transcripts, and AI summaries.';
