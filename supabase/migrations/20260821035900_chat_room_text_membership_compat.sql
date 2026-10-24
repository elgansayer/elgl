-- Type compatibility for chat-room membership checks.
--
-- public.chat_messages.room_id has been TEXT since 003_chat_and_favourites,
-- while chat_rooms.id and chat_room_members.room_id are UUID. Two later
-- migrations compare them directly:
--   * 20260821040000_group_chat_rls calls is_chat_room_member(room_id, ...)
--     with the TEXT column, but only defines a (uuid, uuid) function;
--   * 20260822195800_harden_message_reactions joins
--     membership.room_id = message.room_id (uuid = text).
-- Both fail deterministically on a fresh database ("function ... does not
-- exist" / "operator does not exist: uuid = text"), so they cannot have been
-- applied anywhere. Migration history is append-only, so instead of editing
-- them this migration, ordered before both, provides the missing typed
-- comparisons.
--
-- Equality is defined on the canonical text form of the UUID. These operators
-- only make previously invalid uuid/text comparisons valid; no existing
-- well-typed query changes meaning.

CREATE OR REPLACE FUNCTION public.chat_uuid_eq_text(p_left uuid, p_right text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_left::text = p_right;
$$;

CREATE OR REPLACE FUNCTION public.chat_text_eq_uuid(p_left text, p_right uuid)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT p_left = p_right::text;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_operator
    WHERE oprname = '='
      AND oprleft = 'uuid'::regtype
      AND oprright = 'text'::regtype
      AND oprnamespace = 'public'::regnamespace
  ) THEN
    CREATE OPERATOR public.= (
      LEFTARG = uuid,
      RIGHTARG = text,
      FUNCTION = public.chat_uuid_eq_text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_operator
    WHERE oprname = '='
      AND oprleft = 'text'::regtype
      AND oprright = 'uuid'::regtype
      AND oprnamespace = 'public'::regnamespace
  ) THEN
    CREATE OPERATOR public.= (
      LEFTARG = text,
      RIGHTARG = uuid,
      FUNCTION = public.chat_text_eq_uuid
    );
  END IF;
END;
$$;

-- TEXT room ids (chat_messages.room_id) resolve membership against UUID rooms.
CREATE OR REPLACE FUNCTION public.is_chat_room_member(
  p_room_id text,
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
    WHERE member.room_id::text = p_room_id
      AND member.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_chat_room_member(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_room_member(text, uuid) TO service_role;
