import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261114120000_create_groups_and_communities_schema.sql',
);

describe('groups and communities schema (#9932)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('creates every table the mounted services query', () => {
    for (const table of [
      'communities',
      'groups',
      'group_members',
      'group_announcements',
      'group_resources',
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
      );
    }
  });

  it('matches the groups column contract used by GroupsService', () => {
    for (const column of [
      'name TEXT NOT NULL',
      'owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE',
      'community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL',
      'interest_id UUID',
      'max_members SMALLINT NOT NULL DEFAULT 19',
      'can_send_messages BOOLEAN NOT NULL DEFAULT true',
      'can_edit_info BOOLEAN NOT NULL DEFAULT false',
      'description TEXT',
      'rules TEXT',
      'chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE SET NULL',
      'created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    ]) {
      expect(sql).toContain(column);
    }
  });

  it('enforces one group per chat room and the service member bounds', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS groups_chat_room_id_unique[\s\S]*WHERE chat_room_id IS NOT NULL/,
    );
    expect(sql).toMatch(/CHECK \(max_members BETWEEN 2 AND 19\)/);
    expect(sql).toMatch(
      /CONSTRAINT group_members_group_user_key UNIQUE \(group_id, user_id\)/,
    );
  });

  it('cascades group content and membership when a group is deleted', () => {
    for (const table of [
      'group_members',
      'group_announcements',
      'group_resources',
    ]) {
      expect(sql).toMatch(
        new RegExp(
          `CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?group_id UUID NOT NULL REFERENCES public\\.groups\\(id\\) ON DELETE CASCADE`,
        ),
      );
    }
  });

  it('adds the indexes the services filter and count on', () => {
    for (const index of [
      'groups_owner_id_idx',
      'groups_community_id_idx',
      'groups_interest_id_idx',
      'group_members_group_id_idx',
      'group_members_user_id_idx',
      'group_announcements_group_created_idx',
      'group_resources_group_created_idx',
      'communities_owner_id_idx',
    ]) {
      expect(sql).toContain(`CREATE INDEX IF NOT EXISTS ${index}`);
    }
  });

  it('enables membership-aware row level security without policy recursion', () => {
    for (const table of [
      'communities',
      'groups',
      'group_members',
      'group_announcements',
      'group_resources',
    ]) {
      expect(sql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
    }

    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.is_group_member\([\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.is_group_member\(UUID, UUID\) FROM PUBLIC;/,
    );
    expect(sql).toMatch(
      /CREATE POLICY group_members_select_member ON public\.group_members[\s\S]*?USING \(user_id = auth\.uid\(\) OR public\.is_group_member\(group_id, auth\.uid\(\)\)\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY group_announcements_select_member ON public\.group_announcements[\s\S]*?USING \(public\.is_group_member\(group_id, auth\.uid\(\)\)\)/,
    );
    expect(sql).toMatch(
      /CREATE POLICY groups_update_owner ON public\.groups[\s\S]*?USING \(owner_id = auth\.uid\(\)\)/,
    );
  });

  it('seeds demo rows only when a real user exists', () => {
    expect(sql).toMatch(/SELECT id INTO v_owner[\s\S]*?FROM public\.users/);
    expect(sql).toMatch(/IF v_owner IS NULL THEN\s+RETURN;/);
    expect(sql).toMatch(
      /INSERT INTO public\.communities[\s\S]*?ON CONFLICT \(id\) DO NOTHING/,
    );
    expect(sql).toMatch(
      /INSERT INTO public\.group_members[\s\S]*?ON CONFLICT \(group_id, user_id\) DO NOTHING/,
    );
  });
});
