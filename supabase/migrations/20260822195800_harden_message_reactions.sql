-- Harden the existing message_reactions table for the production chat API.
-- The table originated in 014_chat_rooms_table.sql; this forward migration keeps
-- deployed migration history immutable while adding authorization and abuse bounds.

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.message_reactions
  DROP CONSTRAINT IF EXISTS message_reactions_supported_emoji;
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_supported_emoji
  CHECK (emoji IN ('❤️', '😂', '👍', '😮', '😢', '🙏')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_created_at
  ON public.message_reactions (message_id, created_at);

DROP POLICY IF EXISTS message_reactions_member_select ON public.message_reactions;
CREATE POLICY message_reactions_member_select
  ON public.message_reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages AS message
      JOIN public.chat_room_members AS membership
        ON membership.room_id = message.room_id
      WHERE message.id = message_reactions.message_id
        AND membership.user_id = auth.uid()
        AND COALESCE(message.is_deleted, false) = false
    )
  );

-- Keep ownership policies in place as defence in depth if direct mutation grants are
-- intentionally restored later. Current clients mutate through the authenticated API.
DROP POLICY IF EXISTS message_reactions_owner_insert ON public.message_reactions;
CREATE POLICY message_reactions_owner_insert
  ON public.message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages AS message
      JOIN public.chat_room_members AS membership
        ON membership.room_id = message.room_id
      WHERE message.id = message_reactions.message_id
        AND membership.user_id = auth.uid()
        AND COALESCE(message.is_deleted, false) = false
    )
  );

DROP POLICY IF EXISTS message_reactions_owner_delete ON public.message_reactions;
CREATE POLICY message_reactions_owner_delete
  ON public.message_reactions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages AS message
      JOIN public.chat_room_members AS membership
        ON membership.room_id = message.room_id
      WHERE message.id = message_reactions.message_id
        AND membership.user_id = auth.uid()
        AND COALESCE(message.is_deleted, false) = false
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.message_reactions FROM anon, authenticated;
GRANT SELECT ON public.message_reactions TO authenticated;
