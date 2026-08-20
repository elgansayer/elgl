-- Issue #844: Group chats are deliberately small study groups (2-19 people).
-- Keep the invariant in Postgres as well as the API so concurrent/admin clients
-- cannot overfill a room, enumerate private rooms or write as non-members.

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS topic TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_group_created_at
  ON public.chat_rooms (created_at DESC)
  WHERE type = 'group' AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_room
  ON public.chat_room_members (user_id, room_id);

CREATE OR REPLACE FUNCTION public.enforce_group_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  is_group boolean;
  member_count integer;
BEGIN
  -- Lock the room row so concurrent member additions serialize for this room.
  SELECT (type = 'group')
    INTO is_group
    FROM public.chat_rooms
   WHERE id = NEW.room_id
   FOR UPDATE;

  IF COALESCE(is_group, false) THEN
    SELECT count(*) INTO member_count
      FROM public.chat_room_members
     WHERE room_id = NEW.room_id;

    IF member_count >= 19 THEN
      RAISE EXCEPTION 'Group chats are limited to 19 members'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_member_limit
  ON public.chat_room_members;
CREATE TRIGGER trg_enforce_group_member_limit
BEFORE INSERT ON public.chat_room_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_limit();

CREATE OR REPLACE FUNCTION public.enforce_group_message_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  room_type text;
BEGIN
  SELECT type INTO room_type
    FROM public.chat_rooms
   WHERE id = NEW.room_id;

  IF room_type = 'group' AND NOT EXISTS (
    SELECT 1
      FROM public.chat_room_members
     WHERE room_id = NEW.room_id
       AND user_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'Only group members can send messages to this room'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_group_message_membership
  ON public.chat_messages;
CREATE TRIGGER trg_enforce_group_message_membership
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_message_membership();

-- SECURITY DEFINER avoids recursive chat_room_members RLS evaluation while the
-- public policies below still use auth.uid() as their only identity input.
CREATE OR REPLACE FUNCTION public.is_chat_room_member(
  target_room_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.chat_room_members
     WHERE room_id = target_room_id
       AND user_id = target_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_message(
  target_message_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.chat_messages message
     WHERE message.id = target_message_id
       AND public.is_chat_room_member(message.room_id, target_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_room_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_chat_message(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_chat_message(uuid, uuid) TO authenticated, service_role;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_rooms_member_select ON public.chat_rooms;
CREATE POLICY chat_rooms_member_select
  ON public.chat_rooms
  FOR SELECT
  TO authenticated
  USING (public.is_chat_room_member(id, auth.uid()));

DROP POLICY IF EXISTS chat_room_members_member_select ON public.chat_room_members;
CREATE POLICY chat_room_members_member_select
  ON public.chat_room_members
  FOR SELECT
  TO authenticated
  USING (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_member_select ON public.chat_messages;
CREATE POLICY chat_messages_member_select
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (public.is_chat_room_member(room_id, auth.uid()));

DROP POLICY IF EXISTS chat_messages_member_insert ON public.chat_messages;
CREATE POLICY chat_messages_member_insert
  ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_chat_room_member(room_id, auth.uid())
  );

DROP POLICY IF EXISTS message_reactions_member_select ON public.message_reactions;
CREATE POLICY message_reactions_member_select
  ON public.message_reactions
  FOR SELECT
  TO authenticated
  USING (public.can_access_chat_message(message_id, auth.uid()));

DROP POLICY IF EXISTS message_reactions_member_insert ON public.message_reactions;
CREATE POLICY message_reactions_member_insert
  ON public.message_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_chat_message(message_id, auth.uid())
  );

DROP POLICY IF EXISTS message_reactions_owner_delete ON public.message_reactions;
CREATE POLICY message_reactions_owner_delete
  ON public.message_reactions
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND public.can_access_chat_message(message_id, auth.uid())
  );
