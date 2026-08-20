-- Issue #844: Group chats are deliberately small study groups (2-19 people).
-- Keep the invariant in Postgres as well as the API so concurrent/admin clients
-- cannot overfill a room or write messages as non-members.

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
