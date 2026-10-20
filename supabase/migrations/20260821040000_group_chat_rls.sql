-- Membership-scoped RLS for canonical chat rooms/messages.
--
-- The NestJS API uses service_role and therefore bypasses RLS, but the project
-- intentionally keeps RLS as defence in depth for leaked/future authenticated
-- Supabase clients. Earlier policy 009 allowed every authenticated user to read
-- chat_rooms and only allowed message senders to read their own messages. Group
-- chats require the inverse contract: only room members may read the room,
-- membership roster, and all messages in that room.

CREATE OR REPLACE FUNCTION public.is_chat_room_member(
  p_room_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members member
    WHERE member.room_id = p_room_id
      AND member.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_room_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(uuid, uuid) TO service_role;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Replace the legacy broad room policy with membership visibility.
DROP POLICY IF EXISTS chat_rooms_select_authenticated ON public.chat_rooms;
DROP POLICY IF EXISTS chat_rooms_select_member ON public.chat_rooms;
CREATE POLICY chat_rooms_select_member ON public.chat_rooms
  FOR SELECT TO authenticated
  USING (
    public.is_chat_room_member(id, auth.uid())
    AND coalesce(is_deleted, false) = false
  );

-- Membership rows are visible only to another member of the same room. Direct
-- client-side membership mutation remains disabled; group changes go through
-- the authenticated Nest API and transaction-safe service_role RPCs.
DROP POLICY IF EXISTS chat_room_members_select_member ON public.chat_room_members;
CREATE POLICY chat_room_members_select_member ON public.chat_room_members
  FOR SELECT TO authenticated
  USING (public.is_chat_room_member(room_id, auth.uid()));

-- Replace sender-only message reads with room membership reads. Preserve the
-- existing sender ownership condition for direct authenticated inserts and add
-- the room-membership check so a guessed room UUID cannot be written to.
DROP POLICY IF EXISTS chat_messages_select_own ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_select_member ON public.chat_messages;
CREATE POLICY chat_messages_select_member ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_insert_own ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_insert_member ON public.chat_messages;
CREATE POLICY chat_messages_insert_member ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_chat_room_member(room_id, auth.uid())
  );
