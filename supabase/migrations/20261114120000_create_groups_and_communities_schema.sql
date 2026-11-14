-- Community groups schema.
--
-- GroupsModule and CommunitiesModule are mounted and query these five tables,
-- but no replayed migration created them: the only earlier attempt
-- (20261109090000_add_group_chat_and_event_ticketing_metadata.sql) guards its
-- ALTER on a groups table that a clean replay never creates. This migration
-- establishes the schema the services already use, with foreign keys to
-- users/chat_rooms, membership-aware row level security, and idempotent seed
-- rows for a freshly seeded environment.

CREATE TABLE IF NOT EXISTS public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT communities_name_length_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 200)
);

CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  interest_id UUID,
  max_members SMALLINT NOT NULL DEFAULT 19,
  can_send_messages BOOLEAN NOT NULL DEFAULT true,
  can_edit_info BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  rules TEXT,
  chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT groups_name_length_check
    CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  CONSTRAINT groups_max_members_check
    CHECK (max_members BETWEEN 2 AND 19)
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_members_group_user_key UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_announcements_message_length_check
    CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000)
);

CREATE TABLE IF NOT EXISTS public.group_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_resources_title_length_check
    CHECK (char_length(btrim(title)) BETWEEN 1 AND 200)
);

-- One chat room backs at most one group. The historical migration already
-- creates this index when a groups table pre-exists, so create it here for a
-- clean replay.
CREATE UNIQUE INDEX IF NOT EXISTS groups_chat_room_id_unique
  ON public.groups (chat_room_id)
  WHERE chat_room_id IS NOT NULL;

-- Indexes the services rely on.
CREATE INDEX IF NOT EXISTS groups_owner_id_idx
  ON public.groups (owner_id);
CREATE INDEX IF NOT EXISTS groups_community_id_idx
  ON public.groups (community_id)
  WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS groups_interest_id_idx
  ON public.groups (interest_id)
  WHERE interest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS group_members_group_id_idx
  ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx
  ON public.group_members (user_id);
CREATE INDEX IF NOT EXISTS group_announcements_group_created_idx
  ON public.group_announcements (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_resources_group_created_idx
  ON public.group_resources (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS communities_owner_id_idx
  ON public.communities (owner_id);

-- GroupsService embeds interests(name) through groups.interest_id, which needs a
-- foreign key for PostgREST to resolve. The interests table is not part of the
-- replayed corpus yet, so add the constraint only where it exists.
DO $$
BEGIN
  IF to_regclass('public.interests') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'groups_interest_id_fkey'
         AND conrelid = 'public.groups'::regclass
     ) THEN
    ALTER TABLE public.groups
      ADD CONSTRAINT groups_interest_id_fkey
      FOREIGN KEY (interest_id)
      REFERENCES public.interests(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Membership checks run inside RLS policies. A SECURITY DEFINER helper avoids
-- recursive policy evaluation on group_members.
CREATE OR REPLACE FUNCTION public.is_group_member(
  p_group_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members member
    WHERE member.group_id = p_group_id
      AND member.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO service_role;

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_resources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.communities FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.groups FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.group_members FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.group_announcements FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.group_resources FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.communities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.group_resources TO authenticated;
GRANT ALL ON TABLE public.communities TO service_role;
GRANT ALL ON TABLE public.groups TO service_role;
GRANT ALL ON TABLE public.group_members TO service_role;
GRANT ALL ON TABLE public.group_announcements TO service_role;
GRANT ALL ON TABLE public.group_resources TO service_role;

-- Communities are a public directory: signed-in users may browse them, while
-- only the owner may create or mutate one.
DROP POLICY IF EXISTS communities_select_authenticated ON public.communities;
CREATE POLICY communities_select_authenticated ON public.communities
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS communities_insert_owner ON public.communities;
CREATE POLICY communities_insert_owner ON public.communities
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS communities_update_owner ON public.communities;
CREATE POLICY communities_update_owner ON public.communities
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS communities_delete_owner ON public.communities;
CREATE POLICY communities_delete_owner ON public.communities
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Group discovery is public to signed-in users, matching
-- GroupsService.getDiscoverableGroups; roster and content stay member scoped.
DROP POLICY IF EXISTS groups_select_authenticated ON public.groups;
CREATE POLICY groups_select_authenticated ON public.groups
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS groups_insert_owner ON public.groups;
CREATE POLICY groups_insert_owner ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS groups_update_owner ON public.groups;
CREATE POLICY groups_update_owner ON public.groups
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS groups_delete_owner ON public.groups;
CREATE POLICY groups_delete_owner ON public.groups
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- A member sees the roster of its own group. Joining is self-service; removing
-- another member requires group ownership.
DROP POLICY IF EXISTS group_members_select_member ON public.group_members;
CREATE POLICY group_members_select_member ON public.group_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS group_members_insert_self ON public.group_members;
CREATE POLICY group_members_insert_self ON public.group_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS group_members_delete_self_or_owner ON public.group_members;
CREATE POLICY group_members_delete_self_or_owner ON public.group_members
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.groups group_row
      WHERE group_row.id = group_id
        AND group_row.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS group_announcements_select_member ON public.group_announcements;
CREATE POLICY group_announcements_select_member ON public.group_announcements
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS group_announcements_insert_owner ON public.group_announcements;
CREATE POLICY group_announcements_insert_owner ON public.group_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.groups group_row
      WHERE group_row.id = group_id
        AND group_row.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS group_resources_select_member ON public.group_resources;
CREATE POLICY group_resources_select_member ON public.group_resources
  FOR SELECT TO authenticated
  USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS group_resources_insert_owner ON public.group_resources;
CREATE POLICY group_resources_insert_owner ON public.group_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.groups group_row
      WHERE group_row.id = group_id
        AND group_row.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS group_resources_delete_owner ON public.group_resources;
CREATE POLICY group_resources_delete_owner ON public.group_resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.groups group_row
      WHERE group_row.id = group_id
        AND group_row.owner_id = auth.uid()
    )
  );

-- Seed one discoverable community and group for the first real user. A clean
-- replay has no auth.users rows, so the block is a no-op there and never fails
-- a replay on a foreign key.
DO $$
DECLARE
  v_owner UUID;
  v_community UUID := '6f1f5f0e-3c2a-4f6b-9a8d-2f2f4b6c9d01';
  v_group UUID := '6f1f5f0e-3c2a-4f6b-9a8d-2f2f4b6c9d02';
BEGIN
  SELECT id INTO v_owner
  FROM public.users
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.communities (id, name, description, owner_id)
  VALUES (
    v_community,
    'Language Exchange',
    'Default community seeded for a freshly provisioned environment.',
    v_owner
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (
    id, name, owner_id, community_id, max_members, description, rules
  )
  VALUES (
    v_group,
    'Spanish Practice Circle',
    v_owner,
    v_community,
    19,
    'Beginner-friendly Spanish conversation group.',
    'Be kind, correct gently, and stay on topic.'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group, v_owner)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  INSERT INTO public.group_announcements (group_id, sender_id, message)
  VALUES (
    v_group,
    v_owner,
    'Welcome! Introduce yourself and pick a practice topic.'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.group_resources (group_id, title, url, description)
  VALUES (
    v_group,
    'Beginner conversation prompts',
    'https://example.org/spanish-prompts',
    'Seeded prompt list for the first practice session.'
  )
  ON CONFLICT DO NOTHING;
END
$$;
