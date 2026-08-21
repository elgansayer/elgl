import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/003_chat_and_favourites.sql'),
  'utf8',
);
const rls = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/009_row_level_security.sql'),
  'utf8',
);
const baseSchema = readFileSync(
  resolve(repositoryRoot, 'supabase/migrations/001_initial_schema.sql'),
  'utf8',
);

describe('003_chat_and_favourites migration contract', () => {
  it('stores chat room, sender, content and delivery metadata', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.chat_messages/i);
    expect(migration).toMatch(/room_id\s+TEXT\s+NOT NULL/i);
    expect(migration).toMatch(
      /sender_id\s+UUID\s+NOT NULL\s+REFERENCES public\.users\(id\)\s+ON DELETE CASCADE/i,
    );
    expect(migration).toMatch(
      /message_type\s+VARCHAR\(50\)\s+NOT NULL\s+DEFAULT 'text'/i,
    );
    expect(migration).toMatch(/correction_payload\s+JSONB/i);
    expect(migration).toMatch(/is_read\s+BOOLEAN\s+NOT NULL\s+DEFAULT false/i);
    expect(migration).toMatch(
      /created_at\s+TIMESTAMPTZ\s+NOT NULL\s+DEFAULT now\(\)/i,
    );
  });

  it('indexes room history, sender lookup and message text search', () => {
    expect(migration).toMatch(
      /chat_messages_room_id_idx\s+ON public\.chat_messages\s*\(room_id,\s*created_at ASC\)/i,
    );
    expect(migration).toMatch(
      /chat_messages_sender_id_idx\s+ON public\.chat_messages\s*\(sender_id\)/i,
    );
    expect(migration).toMatch(
      /chat_messages_text_content_trgm_idx\s+ON public\.chat_messages\s+USING GIN\s*\(text_content gin_trgm_ops\)/i,
    );
    expect(baseSchema).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/i);
  });

  it('owns favourites by user and message and prevents duplicate bookmarks', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS public\.favourites/i);
    expect(migration).toMatch(
      /user_id\s+UUID\s+NOT NULL\s+REFERENCES public\.users\(id\)\s+ON DELETE CASCADE/i,
    );
    expect(migration).toMatch(
      /message_id\s+UUID\s+NOT NULL\s+REFERENCES public\.chat_messages\(id\)\s+ON DELETE CASCADE/i,
    );
    expect(migration).toMatch(
      /CONSTRAINT unique_user_favourite UNIQUE\s*\(user_id,\s*message_id\)/i,
    );
    expect(migration).toMatch(
      /favourites_user_id_idx\s+ON public\.favourites\s*\(user_id,\s*created_at DESC\)/i,
    );
  });

  it('protects chat inserts and favourite access with owner-scoped RLS', () => {
    expect(rls).toMatch(/ALTER TABLE public\.chat_messages ENABLE ROW LEVEL SECURITY/i);
    expect(rls).toMatch(
      /chat_messages_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = sender_id\)/i,
    );
    expect(rls).toMatch(/ALTER TABLE public\.favourites ENABLE ROW LEVEL SECURITY/i);
    expect(rls).toMatch(
      /favourites_select_own[\s\S]*?USING \(auth\.uid\(\) = user_id\)/i,
    );
    expect(rls).toMatch(
      /favourites_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/i,
    );
    expect(rls).toMatch(
      /favourites_delete_own[\s\S]*?USING \(auth\.uid\(\) = user_id\)/i,
    );
  });
});
