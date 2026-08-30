import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readMigration = (name: string) =>
  readFileSync(
    resolve(process.cwd(), '..', 'supabase', 'migrations', name),
    'utf8',
  );

const initialSchema = readMigration('001_initial_schema.sql');
const chatAndFavourites = readMigration('003_chat_and_favourites.sql');
const rowLevelSecurity = readMigration('009_row_level_security.sql');

describe('003_chat_and_favourites migration contract', () => {
  it('creates the chat_messages storage shape required by the chat API', () => {
    expect(initialSchema).toContain(
      'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    );
    expect(chatAndFavourites).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.chat_messages\s*\([\s\S]*?id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/,
    );
    expect(chatAndFavourites).toMatch(/room_id TEXT NOT NULL/);
    expect(chatAndFavourites).toMatch(
      /sender_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(chatAndFavourites).toMatch(
      /message_type VARCHAR\(50\) NOT NULL DEFAULT 'text'/,
    );
    expect(chatAndFavourites).toMatch(/text_content TEXT/);
    expect(chatAndFavourites).toMatch(/media_url TEXT/);
    expect(chatAndFavourites).toMatch(/correction_payload JSONB/);
    expect(chatAndFavourites).toMatch(/is_read BOOLEAN NOT NULL DEFAULT false/);
    expect(chatAndFavourites).toMatch(
      /created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/,
    );
  });

  it('creates bounded-query indexes for room history, sender lookup, and text search', () => {
    expect(chatAndFavourites).toContain(
      'CREATE INDEX IF NOT EXISTS chat_messages_room_id_idx ON public.chat_messages (room_id, created_at ASC);',
    );
    expect(chatAndFavourites).toContain(
      'CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx ON public.chat_messages (sender_id);',
    );
    expect(chatAndFavourites).toContain(
      'CREATE INDEX IF NOT EXISTS chat_messages_text_content_trgm_idx ON public.chat_messages USING GIN (text_content gin_trgm_ops);',
    );
    expect(initialSchema).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm;/);
  });

  it('creates owner-scoped favourites with cascade cleanup and duplicate protection', () => {
    expect(chatAndFavourites).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.favourites\s*\([\s\S]*?id UUID PRIMARY KEY DEFAULT uuid_generate_v4\(\)/,
    );
    expect(chatAndFavourites).toMatch(
      /user_id UUID NOT NULL REFERENCES public\.users\(id\) ON DELETE CASCADE/,
    );
    expect(chatAndFavourites).toMatch(
      /message_id UUID NOT NULL REFERENCES public\.chat_messages\(id\) ON DELETE CASCADE/,
    );
    expect(chatAndFavourites).toMatch(/note_text TEXT/);
    expect(chatAndFavourites).toMatch(
      /created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/,
    );
    expect(chatAndFavourites).toMatch(
      /CONSTRAINT unique_user_favourite UNIQUE \(user_id, message_id\)/,
    );
    expect(chatAndFavourites).toContain(
      'CREATE INDEX IF NOT EXISTS favourites_user_id_idx ON public.favourites (user_id, created_at DESC);',
    );
  });

  it('keeps the historical migration replay-safe and non-destructive', () => {
    const tableCreates =
      chatAndFavourites.match(/CREATE TABLE IF NOT EXISTS/g) ?? [];
    const indexCreates =
      chatAndFavourites.match(/CREATE INDEX IF NOT EXISTS/g) ?? [];

    expect(tableCreates).toHaveLength(2);
    expect(indexCreates).toHaveLength(4);
    expect(chatAndFavourites).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
    expect(chatAndFavourites).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('has defence-in-depth RLS for the tables established by the migration', () => {
    expect(rowLevelSecurity).toContain(
      'ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;',
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY chat_messages_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = sender_id\)/,
    );
    expect(rowLevelSecurity).toContain(
      'ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;',
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY favourites_select_own[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY favourites_insert_own[\s\S]*?WITH CHECK \(auth\.uid\(\) = user_id\)/,
    );
    expect(rowLevelSecurity).toMatch(
      /CREATE POLICY favourites_delete_own[\s\S]*?USING \(auth\.uid\(\) = user_id\)/,
    );
  });
});
