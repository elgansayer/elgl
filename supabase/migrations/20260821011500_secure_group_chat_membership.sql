-- Secure, bounded group-chat membership primitives for issue #844.
--
-- The application already models direct/group conversations in chat_rooms and
-- chat_room_members. This migration completes the group-specific invariants at
-- the database boundary so concurrent API requests cannot overfill a room or
-- leave it without an administrator.

ALTER TABLE public.chat_rooms
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_members smallint NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.chat_rooms
  DROP CONSTRAINT IF EXISTS chat_rooms_group_capacity_check;
ALTER TABLE public.chat_rooms
  ADD CONSTRAINT chat_rooms_group_capacity_check
  CHECK (max_members BETWEEN 2 AND 19);

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_room
  ON public.chat_room_members(user_id, room_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_group_admin
  ON public.chat_rooms(admin_id)
  WHERE type = 'group' AND is_deleted = false;

CREATE OR REPLACE FUNCTION public.create_group_chat(
  p_creator_id uuid,
  p_title text,
  p_member_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_members uuid[];
  v_expected integer;
  v_existing integer;
BEGIN
  IF p_creator_id IS NULL THEN
    RAISE EXCEPTION 'creator_required' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(coalesce(p_title, ''))) < 1 OR char_length(btrim(p_title)) > 120 THEN
    RAISE EXCEPTION 'invalid_group_title' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT member_id), ARRAY[]::uuid[])
  INTO v_members
  FROM unnest(coalesce(p_member_ids, ARRAY[]::uuid[])) member_id
  WHERE member_id IS NOT NULL AND member_id <> p_creator_id;

  IF cardinality(v_members) < 1 OR cardinality(v_members) > 18 THEN
    RAISE EXCEPTION 'group_size_must_be_between_2_and_19' USING ERRCODE = '22023';
  END IF;

  v_expected := cardinality(v_members) + 1;
  SELECT count(*) INTO v_existing
  FROM public.users
  WHERE id = ANY(array_append(v_members, p_creator_id));

  IF v_existing <> v_expected THEN
    RAISE EXCEPTION 'group_member_not_found' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.chat_rooms (
    type,
    name,
    title,
    created_by,
    admin_id,
    max_members,
    created_at,
    updated_at
  ) VALUES (
    'group',
    btrim(p_title),
    btrim(p_title),
    p_creator_id,
    p_creator_id,
    19,
    now(),
    now()
  ) RETURNING id INTO v_room_id;

  INSERT INTO public.chat_room_members (room_id, user_id, role, joined_at)
  VALUES (v_room_id, p_creator_id, 'admin', now());

  INSERT INTO public.chat_room_members (room_id, user_id, role, joined_at)
  SELECT v_room_id, member_id, 'member', now()
  FROM unnest(v_members) member_id;

  RETURN v_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_group_chat_members(
  p_requester_id uuid,
  p_room_id uuid,
  p_member_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.chat_rooms%ROWTYPE;
  v_members uuid[];
  v_current integer;
  v_existing integer;
BEGIN
  SELECT * INTO v_room
  FROM public.chat_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.type <> 'group' OR coalesce(v_room.is_deleted, false) THEN
    RAISE EXCEPTION 'group_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_room.admin_id IS DISTINCT FROM p_requester_id OR NOT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = p_room_id AND user_id = p_requester_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'group_admin_required' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(DISTINCT member_id), ARRAY[]::uuid[])
  INTO v_members
  FROM unnest(coalesce(p_member_ids, ARRAY[]::uuid[])) member_id
  WHERE member_id IS NOT NULL
    AND member_id <> p_requester_id
    AND NOT EXISTS (
      SELECT 1 FROM public.chat_room_members existing
      WHERE existing.room_id = p_room_id AND existing.user_id = member_id
    );

  IF cardinality(v_members) = 0 THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_current
  FROM public.chat_room_members
  WHERE room_id = p_room_id;

  IF v_current + cardinality(v_members) > least(coalesce(v_room.max_members, 19), 19) THEN
    RAISE EXCEPTION 'group_capacity_exceeded' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.users
  WHERE id = ANY(v_members);

  IF v_existing <> cardinality(v_members) THEN
    RAISE EXCEPTION 'group_member_not_found' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.chat_room_members (room_id, user_id, role, joined_at)
  SELECT p_room_id, member_id, 'member', now()
  FROM unnest(v_members) member_id
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN cardinality(v_members);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_group_chat_member(
  p_requester_id uuid,
  p_room_id uuid,
  p_member_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.chat_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room
  FROM public.chat_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.type <> 'group' OR coalesce(v_room.is_deleted, false) THEN
    RAISE EXCEPTION 'group_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_room.admin_id IS DISTINCT FROM p_requester_id THEN
    RAISE EXCEPTION 'group_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_member_id = v_room.admin_id THEN
    RAISE EXCEPTION 'transfer_admin_before_removal' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.chat_room_members
  WHERE room_id = p_room_id AND user_id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'group_member_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_group_chat_admin(
  p_requester_id uuid,
  p_room_id uuid,
  p_new_admin_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.chat_rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room
  FROM public.chat_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.type <> 'group' OR coalesce(v_room.is_deleted, false) THEN
    RAISE EXCEPTION 'group_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_room.admin_id IS DISTINCT FROM p_requester_id THEN
    RAISE EXCEPTION 'group_admin_required' USING ERRCODE = '42501';
  END IF;

  IF p_new_admin_id = p_requester_id THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = p_room_id AND user_id = p_new_admin_id
  ) THEN
    RAISE EXCEPTION 'new_admin_must_be_member' USING ERRCODE = '22023';
  END IF;

  UPDATE public.chat_room_members
  SET role = 'member'
  WHERE room_id = p_room_id AND user_id = p_requester_id;

  UPDATE public.chat_room_members
  SET role = 'admin'
  WHERE room_id = p_room_id AND user_id = p_new_admin_id;

  UPDATE public.chat_rooms
  SET admin_id = p_new_admin_id, updated_at = now()
  WHERE id = p_room_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_group_chat(
  p_user_id uuid,
  p_room_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.chat_rooms%ROWTYPE;
  v_count integer;
BEGIN
  SELECT * INTO v_room
  FROM public.chat_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND OR v_room.type <> 'group' OR coalesce(v_room.is_deleted, false) THEN
    RAISE EXCEPTION 'group_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_room_members
    WHERE room_id = p_room_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'group_membership_required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.chat_room_members
  WHERE room_id = p_room_id;

  IF p_user_id = v_room.admin_id AND v_count > 1 THEN
    RAISE EXCEPTION 'transfer_admin_before_leaving' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.chat_room_members
  WHERE room_id = p_room_id AND user_id = p_user_id;

  IF v_count = 1 THEN
    UPDATE public.chat_rooms
    SET is_deleted = true, deleted_at = now(), updated_at = now()
    WHERE id = p_room_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Even service-role application writes pass through triggers. This closes the
-- historical hole where a caller could post into a room they did not belong to.
CREATE OR REPLACE FUNCTION public.enforce_chat_sender_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.chat_room_members member
    JOIN public.chat_rooms room ON room.id = member.room_id
    WHERE member.room_id = NEW.room_id
      AND member.user_id = NEW.sender_id
      AND coalesce(room.is_deleted, false) = false
  ) THEN
    RAISE EXCEPTION 'chat_room_membership_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_chat_sender_membership ON public.chat_messages;
CREATE TRIGGER enforce_chat_sender_membership
BEFORE INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_sender_membership();

REVOKE ALL ON FUNCTION public.create_group_chat(uuid, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_group_chat_members(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_group_chat_member(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transfer_group_chat_admin(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_group_chat(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_group_chat(uuid, text, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_group_chat_members(uuid, uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_group_chat_member(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_group_chat_admin(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.leave_group_chat(uuid, uuid) TO service_role;
