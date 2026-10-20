import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '..',
    'supabase',
    'migrations',
    '20260910000000_chat_unread_count.sql',
  ),
  'utf8',
);

describe('chat unread count migration', () => {
  it('makes the lock and per-user deletion predicates available replay-safely', () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false/,
    );
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS deleted_for_user_ids UUID\[\] NOT NULL DEFAULT '\{\}'::UUID\[\]/,
    );
  });

  it('counts unread incoming messages only for rooms the user belongs to', () => {
    expect(migration).toMatch(
      /INNER JOIN public\.chat_room_members AS member[\s\S]*member\.room_id::TEXT = message\.room_id/,
    );
    expect(migration).toMatch(/member\.user_id = p_user_id/);
    expect(migration).toMatch(/member\.is_locked = false/);
    expect(migration).toMatch(/message\.sender_id <> p_user_id/);
    expect(migration).toMatch(/message\.delivery_status <> 'read'/);
    expect(migration).toMatch(/message\.is_read = false/);
  });

  it('excludes deleted and blocked messages from the visible unread count', () => {
    expect(migration).toMatch(/message\.is_deleted_for_everyone/);
    expect(migration).toMatch(/TO_JSONB\(message\.deleted_for_user_ids\)/);
    expect(migration).toMatch(/FROM public\.blocks AS block/);
    expect(migration).toMatch(/block\.blocker_id = p_user_id/);
    expect(migration).toMatch(/block\.blocked_id = p_user_id/);
  });

  it('adds indexes for the membership and unread-message predicates', () => {
    expect(migration).toMatch(
      /chat_room_members_user_unlocked_room_idx[\s\S]*\(user_id, room_id\)[\s\S]*WHERE is_locked = false/,
    );
    expect(migration).toMatch(
      /chat_messages_unread_room_sender_idx[\s\S]*\(room_id, sender_id\)[\s\S]*WHERE delivery_status <> 'read'/,
    );
  });

  it('keeps the privileged function behind the service-role boundary', () => {
    expect(migration).toMatch(/SECURITY DEFINER/);
    expect(migration).toMatch(/SET search_path = ''/);
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.count_chat_unread\(UUID\) FROM PUBLIC/,
    );
    expect(migration).toMatch(/FROM anon, authenticated/);
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.count_chat_unread\(UUID\) TO service_role/,
    );
  });
});
