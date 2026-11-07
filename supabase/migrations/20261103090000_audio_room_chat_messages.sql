-- Durable text chat for live audio and video rooms.
--
-- Query pattern:
--   SELECT ... FROM public.audio_room_messages
--   WHERE room_id = $1 ORDER BY created_at DESC, id DESC LIMIT 101 OFFSET $2;
--
-- Rows are retained until their room or sender account is deleted. Both foreign
-- keys cascade, so the existing room and account deletion workflows remain the
-- single owners of retention. The API is the only writer.
--
-- Rollback: stop the message API writer first, then run
--   DROP TABLE IF EXISTS public.audio_room_messages;
-- Existing application versions remain compatible while this additive table is
-- present because the historical browser-publish path does not read it.

CREATE TABLE IF NOT EXISTS public.audio_room_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES public.audio_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name VARCHAR(255) NOT NULL,
  client_message_id UUID NOT NULL,
  text_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audio_room_messages_text_length_check
    CHECK (char_length(btrim(text_content)) BETWEEN 1 AND 1000),
  CONSTRAINT audio_room_messages_idempotency_unique
    UNIQUE (room_id, sender_id, client_message_id)
);

CREATE INDEX IF NOT EXISTS audio_room_messages_room_created_idx
  ON public.audio_room_messages (room_id, created_at DESC, id DESC);

ALTER TABLE public.audio_room_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Room participants can view live-room messages"
  ON public.audio_room_messages;
CREATE POLICY "Room participants can view live-room messages"
  ON public.audio_room_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.audio_room_participants participant
      WHERE participant.room_id = audio_room_messages.room_id
        AND participant.user_id = auth.uid()
    )
  );

-- Direct authenticated writes intentionally have no policy. The NestJS API
-- verifies participation, trims and validates content, persists idempotently,
-- and only then publishes the canonical row to Centrifugo.
