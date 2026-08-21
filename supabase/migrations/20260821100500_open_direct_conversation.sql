-- Create or reuse a unique one-to-one room for two users.
--
-- The advisory transaction lock serialises creation for the unordered user
-- pair, preventing concurrent quick actions from creating duplicate rooms.
-- Existing direct conversations remain usable even if a recipient later
-- tightens first-contact filters; blocks and deleted/deletion-pending accounts
-- are always enforced.
CREATE OR REPLACE FUNCTION public.open_or_create_direct_conversation(
  p_actor_id uuid,
  p_target_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_target public.users%ROWTYPE;
  v_actor public.users%ROWTYPE;
  v_filters jsonb;
  v_allowed_languages jsonb;
  v_allowed_genders jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'direct_conversation_invalid_user';
  END IF;

  IF p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'direct_conversation_self';
  END IF;

  -- One lock per unordered pair for the lifetime of this transaction.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      LEAST(p_actor_id::text, p_target_user_id::text) || ':' ||
      GREATEST(p_actor_id::text, p_target_user_id::text),
      0
    )
  );

  SELECT * INTO v_actor FROM public.users WHERE id = p_actor_id;
  SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id;

  IF NOT FOUND OR v_target.id IS NULL THEN
    RAISE EXCEPTION 'direct_conversation_target_unavailable';
  END IF;

  IF v_actor.id IS NULL
     OR COALESCE(v_actor.is_deleted, false)
     OR v_actor.deleted_at IS NOT NULL
     OR COALESCE(v_actor.is_deletion_pending, false)
     OR v_actor.deletion_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'direct_conversation_actor_unavailable';
  END IF;

  IF COALESCE(v_target.is_deleted, false)
     OR v_target.deleted_at IS NOT NULL
     OR COALESCE(v_target.is_deletion_pending, false)
     OR v_target.deletion_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'direct_conversation_target_unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blocks b
    WHERE (b.blocker_id = p_actor_id AND b.blocked_id = p_target_user_id)
       OR (b.blocker_id = p_target_user_id AND b.blocked_id = p_actor_id)
  ) THEN
    RAISE EXCEPTION 'direct_conversation_blocked';
  END IF;

  -- Reuse a direct room containing exactly these two members.
  SELECT r.id
    INTO v_room_id
  FROM public.chat_rooms r
  JOIN public.chat_room_members mine
    ON mine.room_id = r.id AND mine.user_id = p_actor_id
  JOIN public.chat_room_members theirs
    ON theirs.room_id = r.id AND theirs.user_id = p_target_user_id
  WHERE COALESCE(r.type, 'direct') = 'direct'
    AND (
      SELECT count(*)
      FROM public.chat_room_members members
      WHERE members.room_id = r.id
    ) = 2
  ORDER BY r.created_at ASC
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- First-contact filters apply only when starting a new direct conversation.
  v_filters := COALESCE(v_target.message_filters::jsonb, '{}'::jsonb);
  v_allowed_languages := COALESCE(v_filters -> 'allowed_native_languages', '[]'::jsonb);
  v_allowed_genders := COALESCE(v_filters -> 'allowed_genders', '[]'::jsonb);

  IF jsonb_typeof(v_allowed_languages) = 'array'
     AND jsonb_array_length(v_allowed_languages) > 0
     AND COALESCE(array_length(v_actor.native_languages, 1), 0) > 0
     AND NOT EXISTS (
       SELECT 1
       FROM unnest(v_actor.native_languages) language
       WHERE v_allowed_languages ? language
     ) THEN
    RAISE EXCEPTION 'direct_conversation_message_restricted';
  END IF;

  IF (v_filters ? 'age_min')
     AND v_actor.age IS NOT NULL
     AND v_actor.age < (v_filters ->> 'age_min')::integer THEN
    RAISE EXCEPTION 'direct_conversation_message_restricted';
  END IF;

  IF (v_filters ? 'age_max')
     AND v_actor.age IS NOT NULL
     AND v_actor.age > (v_filters ->> 'age_max')::integer THEN
    RAISE EXCEPTION 'direct_conversation_message_restricted';
  END IF;

  IF jsonb_typeof(v_allowed_genders) = 'array'
     AND jsonb_array_length(v_allowed_genders) > 0
     AND NULLIF(v_actor.gender, '') IS NOT NULL
     AND NOT (v_allowed_genders ? v_actor.gender) THEN
    RAISE EXCEPTION 'direct_conversation_message_restricted';
  END IF;

  INSERT INTO public.chat_rooms (type, created_by)
  VALUES ('direct', p_actor_id)
  RETURNING id INTO v_room_id;

  INSERT INTO public.chat_room_members (room_id, user_id)
  VALUES
    (v_room_id, p_actor_id),
    (v_room_id, p_target_user_id);

  RETURN v_room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.open_or_create_direct_conversation(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.open_or_create_direct_conversation(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.open_or_create_direct_conversation(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.open_or_create_direct_conversation(uuid, uuid) TO service_role;
