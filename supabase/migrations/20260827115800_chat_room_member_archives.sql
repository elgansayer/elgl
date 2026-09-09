-- Per-user chat archiving for issue #1685.
--
-- chat_rooms.is_archived predates this feature but is room-global. Archive is a
-- personal inbox state, so it belongs to the membership row instead. This keeps
-- one participant's archive action from hiding the room for everyone else.

ALTER TABLE public.chat_room_members
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Keep timestamp/state internally consistent for new writes. Existing rows are
-- unarchived by default and therefore require no backfill.
ALTER TABLE public.chat_room_members
  DROP CONSTRAINT IF EXISTS chat_room_members_archive_timestamp_check;

ALTER TABLE public.chat_room_members
  ADD CONSTRAINT chat_room_members_archive_timestamp_check
  CHECK (
    (is_archived = false AND archived_at IS NULL)
    OR (is_archived = true AND archived_at IS NOT NULL)
  ) NOT VALID;

ALTER TABLE public.chat_room_members
  VALIDATE CONSTRAINT chat_room_members_archive_timestamp_check;

CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_archived_at
  ON public.chat_room_members (user_id, archived_at DESC)
  WHERE is_archived = true;

COMMENT ON COLUMN public.chat_room_members.is_archived IS
  'Per-user chat inbox state. Archived rooms are hidden from that member''s main chat list.';
COMMENT ON COLUMN public.chat_room_members.archived_at IS
  'UTC timestamp of the member''s most recent archive action; NULL while unarchived.';
