-- Per-recipient read receipts are read and written by the NestJS API through
-- the service_role client. RLS remains enabled as defence in depth so a leaked
-- or future authenticated Supabase client cannot enumerate who read a message
-- outside the message's room or forge delivery state.

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_receipts_select_member ON public.message_receipts;
CREATE POLICY message_receipts_select_member ON public.message_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages message
      JOIN public.chat_room_members member
        ON member.room_id = message.room_id
      WHERE message.id = message_receipts.message_id
        AND member.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS message_receipts_insert_own ON public.message_receipts;
DROP POLICY IF EXISTS message_receipts_update_own ON public.message_receipts;

REVOKE INSERT, UPDATE, DELETE ON public.message_receipts
  FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS message_receipts_read_status_idx
  ON public.message_receipts (message_id)
  WHERE status = 'read';
