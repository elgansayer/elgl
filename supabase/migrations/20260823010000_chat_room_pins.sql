-- Per-user priority chat pins.
-- Keep pin state separate from chat_rooms.is_pinned so one learner cannot
-- reorder another learner's inbox.
CREATE TABLE IF NOT EXISTS public.chat_room_pins (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_room_pins_user_created
  ON public.chat_room_pins (user_id, created_at, room_id);

ALTER TABLE public.chat_room_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_room_pins_select_own ON public.chat_room_pins;
CREATE POLICY chat_room_pins_select_own
  ON public.chat_room_pins
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_pins.room_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_room_pins_insert_own ON public.chat_room_pins;
CREATE POLICY chat_room_pins_insert_own
  ON public.chat_room_pins
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_room_members member
      WHERE member.room_id = chat_room_pins.room_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS chat_room_pins_delete_own ON public.chat_room_pins;
CREATE POLICY chat_room_pins_delete_own
  ON public.chat_room_pins
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.chat_room_pins FROM anon;
GRANT SELECT, INSERT, DELETE ON public.chat_room_pins TO authenticated;

-- Preserve the historical room-level pin as an initial preference for every
-- existing member. New application code writes only chat_room_pins.
INSERT INTO public.chat_room_pins (user_id, room_id)
SELECT member.user_id, member.room_id
FROM public.chat_room_members member
JOIN public.chat_rooms room ON room.id = member.room_id
WHERE COALESCE(room.is_pinned, false) = true
ON CONFLICT (user_id, room_id) DO NOTHING;
