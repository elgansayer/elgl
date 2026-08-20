-- Issue #844: production-safe chat groups built on the existing chat schema.
-- Groups contain 2-19 people total (creator + 1-18 partners).

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS topic TEXT,
  ADD COLUMN IF NOT EXISTS interest_id UUID REFERENCES public.interests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_group_created_at
  ON public.chat_rooms (created_at DESC)
  WHERE type = 'group' AND is_archived = false;

CREATE INDEX IF NOT EXISTS idx_chat_rooms_group_interest
  ON public.chat_rooms (interest_id, created_at DESC)
  WHERE type = 'group' AND is_archived = false AND interest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_room
  ON public.chat_room_members (user_id, room_id);

-- One database transaction creates the room and all initial memberships. Only
-- the backend service role may call this function because p_creator_id is an
-- explicit trusted-service argument rather than auth.uid().
CREATE OR REPLACE FUNCTION public.create_group_chat_atomic(
  p_creator_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_topic text DEFAULT NULL,
  p_interest_id uuid DEFAULT NULL,
  p_member_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS public.chat_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_members uuid[];
  new_room public.chat_rooms;
  expected_members integer;
  found_members integer;
BEGIN
  IF p_creator_id IS NULL THEN
    RAISE EXCEPTION 'Creator is required' USING ERRCODE = '23502';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(p_name) > 200 THEN
    RAISE EXCEPTION 'Group name must contain 1 to 200 characters'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(array_agg(member_id ORDER BY member_id), '{}'::uuid[])
    INTO normalized_members
    FROM (
      SELECT DISTINCT member_id
        FROM unnest(COALESCE(p_member_ids, '{}'::uuid[])) AS member_id
       WHERE member_id IS NOT NULL
         AND member_id <> p_creator_id
    ) deduplicated;

  expected_members := cardinality(normalized_members);
  IF expected_members < 1 OR expected_members > 18 THEN
    RAISE EXCEPTION 'A group must contain 2 to 19 people including the creator'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_creator_id) THEN
    RAISE EXCEPTION 'Creator does not exist' USING ERRCODE = '23503';
  END IF;

  SELECT count(*)
    INTO found_members
    FROM public.users
   WHERE id = ANY(normalized_members);
  IF found_members <> expected_members THEN
    RAISE EXCEPTION 'One or more group members do not exist'
      USING ERRCODE = '23503';
  END IF;

  IF p_interest_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.interests WHERE id = p_interest_id) THEN
    RAISE EXCEPTION 'Group interest does not exist' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.blocks
     WHERE (blocker_id = p_creator_id AND blocked_id = ANY(normalized_members))
        OR (blocked_id = p_creator_id AND blocker_id = ANY(normalized_members))
  ) THEN
    RAISE EXCEPTION 'A blocked user cannot be added to this group'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.chat_rooms (
    type,
    name,
    description,
    topic,
    interest_id,
    created_by,
    is_archived
  ) VALUES (
    'group',
    btrim(p_name),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    NULLIF(btrim(COALESCE(p_topic, '')), ''),
    p_interest_id,
    p_creator_id,
    false
  ) RETURNING * INTO new_room;

  INSERT INTO public.chat_room_members (room_id, user_id, role)
  VALUES (new_room.id, p_creator_id, 'admin');

  INSERT INTO public.chat_room_members (room_id, user_id, role)
  SELECT new_room.id, member_id, 'member'
    FROM unnest(normalized_members) AS member_id;

  RETURN new_room;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_chat_atomic(uuid, text, text, text, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_group_chat_atomic(uuid, text, text, text, uuid, uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_chat_atomic(uuid, text, text, text, uuid, uuid[]) TO service_role;

-- Serialize capacity checks on the room row so simultaneous admin additions
-- cannot race each other past the 19-person limit.
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

-- Account deletion and moderator-driven membership deletion must never strand a
-- live group without an admin. The oldest remaining member is promoted. If the
-- final member disappears, the room is archived rather than left enumerable.
CREATE OR REPLACE FUNCTION public.recover_group_admin_after_member_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  room_is_group boolean;
  next_admin uuid;
BEGIN
  SELECT type = 'group'
    INTO room_is_group
    FROM public.chat_rooms
   WHERE id = OLD.room_id;

  IF NOT COALESCE(room_is_group, false) THEN
    RETURN OLD;
  END IF;

  SELECT user_id
    INTO next_admin
    FROM public.chat_room_members
   WHERE room_id = OLD.room_id
   ORDER BY (role = 'admin') DESC, joined_at ASC, user_id ASC
   LIMIT 1;

  IF next_admin IS NULL THEN
    UPDATE public.chat_rooms
       SET is_archived = true,
           updated_at = now()
     WHERE id = OLD.room_id;
  ELSIF OLD.role = 'admin'
        AND NOT EXISTS (
          SELECT 1
            FROM public.chat_room_members
           WHERE room_id = OLD.room_id
             AND role = 'admin'
        ) THEN
    UPDATE public.chat_room_members
       SET role = 'admin'
     WHERE room_id = OLD.room_id
       AND user_id = next_admin;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_recover_group_admin_after_member_delete
  ON public.chat_room_members;
CREATE TRIGGER trg_recover_group_admin_after_member_delete
AFTER DELETE ON public.chat_room_members
FOR EACH ROW EXECUTE FUNCTION public.recover_group_admin_after_member_delete();

CREATE OR REPLACE FUNCTION public.enforce_group_message_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  room_type text;
  room_archived boolean;
BEGIN
  SELECT type, is_archived
    INTO room_type, room_archived
    FROM public.chat_rooms
   WHERE id = NEW.room_id;

  IF room_type = 'group' THEN
    IF COALESCE(room_archived, false) THEN
      RAISE EXCEPTION 'Archived group chats do not accept new messages'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.chat_room_members
       WHERE room_id = NEW.room_id
         AND user_id = NEW.sender_id
    ) THEN
      RAISE EXCEPTION 'Only group members can send messages to this room'
        USING ERRCODE = '42501';
    END IF;
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
