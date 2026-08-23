-- Per-user chat folders. The historical chat_rooms.is_archived column is shared
-- room state and must not be used for a learner's private inbox preference.
-- is_locked is also converged here because older deployments introduced it via
-- the backend migration path rather than the canonical Supabase history.
ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Folder reads are always scoped by the authenticated member and bounded by the
-- API. Partial indexes keep the common archived/hidden folder scans small.
CREATE INDEX IF NOT EXISTS idx_chat_room_members_archived_user
  ON public.chat_room_members (user_id, joined_at DESC)
  WHERE is_archived = true;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_locked_user
  ON public.chat_room_members (user_id, joined_at DESC)
  WHERE is_locked = true;

COMMENT ON COLUMN public.chat_room_members.is_archived IS
  'Private per-member inbox archive preference; does not archive the room for other members.';

COMMENT ON COLUMN public.chat_room_members.is_locked IS
  'Private per-member hidden-chat preference; room details are revealed only after the client app-unlock flow.';
