-- Count a user's unread chat messages without loading every room and message
-- through the browser. The NestJS API supplies the authenticated user ID and is
-- the only caller allowed to execute this service-role function.

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_for_user_ids UUID[] NOT NULL DEFAULT '{}'::UUID[];

CREATE INDEX IF NOT EXISTS chat_room_members_user_unlocked_room_idx
  ON public.chat_room_members (user_id, room_id)
  WHERE is_locked = false;

CREATE INDEX IF NOT EXISTS chat_messages_unread_room_sender_idx
  ON public.chat_messages (room_id, sender_id)
  WHERE delivery_status <> 'read';

CREATE OR REPLACE FUNCTION public.count_chat_unread(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::BIGINT
  FROM public.chat_messages AS message
  INNER JOIN public.chat_room_members AS member
    ON member.room_id::TEXT = message.room_id
  WHERE member.user_id = p_user_id
    AND member.is_locked = false
    AND message.sender_id <> p_user_id
    AND message.delivery_status <> 'read'
    AND COALESCE(message.is_deleted_for_everyone, false) = false
    AND NOT COALESCE(
      TO_JSONB(message.deleted_for_user_ids) ? p_user_id::TEXT,
      false
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.blocks AS block
      WHERE (block.blocker_id = p_user_id AND block.blocked_id = message.sender_id)
         OR (block.blocker_id = message.sender_id AND block.blocked_id = p_user_id)
    );
$$;

REVOKE ALL ON FUNCTION public.count_chat_unread(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_chat_unread(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_chat_unread(UUID) TO service_role;

COMMENT ON FUNCTION public.count_chat_unread(UUID) IS
  'Returns the membership-scoped unread chat count for the authenticated NestJS API.';
