-- Atomic get-or-create helper for direct profile messaging.
--
-- The repository has historically shipped both TEXT and UUID chat room ids.
-- This function deliberately returns TEXT and uses the deployed chat_rooms id
-- type when inserting memberships so mixed-version databases remain safe.
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(
  p_user_id UUID,
  p_partner_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id TEXT;
  v_new_room_id TEXT := gen_random_uuid()::TEXT;
  v_room_id_type TEXT;
BEGIN
  IF p_user_id IS NULL OR p_partner_id IS NULL THEN
    RAISE EXCEPTION 'direct chat participants are required' USING ERRCODE = '22023';
  END IF;

  IF p_user_id = p_partner_id THEN
    RAISE EXCEPTION 'direct chat participants must be different' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id)
     OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_partner_id) THEN
    RAISE EXCEPTION 'direct chat participant not found' USING ERRCODE = '23503';
  END IF;

  -- Serialize every unordered pair across all API instances. The lock lives for
  -- this database transaction, so concurrent retries cannot create two rooms.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      LEAST(p_user_id::TEXT, p_partner_id::TEXT) || ':' ||
      GREATEST(p_user_id::TEXT, p_partner_id::TEXT),
      0
    )
  );

  SELECT first_member.room_id::TEXT
    INTO v_room_id
  FROM public.chat_room_members AS first_member
  JOIN public.chat_room_members AS second_member
    ON second_member.room_id = first_member.room_id
   AND second_member.user_id = p_partner_id
  WHERE first_member.user_id = p_user_id
    AND (
      SELECT COUNT(*)
      FROM public.chat_room_members AS member_count
      WHERE member_count.room_id = first_member.room_id
    ) = 2
  ORDER BY first_member.room_id::TEXT ASC
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  SELECT a.atttypid::regtype::TEXT
    INTO v_room_id_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.chat_rooms'::regclass
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF v_room_id_type = 'uuid' THEN
    EXECUTE
      'INSERT INTO public.chat_rooms '
      || '(id, title, subtitle, avatar, is_online, is_pinned, created_at) '
      || 'VALUES ($1::uuid, $2, $3, $4, false, false, now())'
      USING v_new_room_id, 'Direct chat', '', '';
  ELSE
    EXECUTE
      'INSERT INTO public.chat_rooms '
      || '(id, title, subtitle, avatar, is_online, is_pinned, created_at) '
      || 'VALUES ($1, $2, $3, $4, false, false, now())'
      USING v_new_room_id, 'Direct chat', '', '';
  END IF;

  -- Selecting the room id back from chat_rooms preserves the deployed id type
  -- (TEXT or UUID) when inserting memberships.
  INSERT INTO public.chat_room_members (room_id, user_id)
  SELECT room.id, participant.user_id
  FROM public.chat_rooms AS room
  CROSS JOIN (
    VALUES (p_user_id), (p_partner_id)
  ) AS participant(user_id)
  WHERE room.id::TEXT = v_new_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'direct chat membership creation failed' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_new_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.get_or_create_direct_chat(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct_chat(UUID, UUID) TO service_role;
