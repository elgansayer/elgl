import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261108000000_hobby_tags_target_vocabulary.sql',
);

describe('hobby tags target vocabulary migration (#1886)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('materialises both tables used by the production API', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.hobby_tags/i);
    expect(sql).toMatch(
      /target_vocabulary JSONB NOT NULL DEFAULT '\[\]'::jsonb/i,
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_hobby_tags/i);
    expect(sql).toMatch(/UNIQUE \(user_id, hobby_tag_id\)/i);
  });

  it('preserves owned-row deletion and bounds new proficiency writes', () => {
    expect(sql).toMatch(/REFERENCES public\.users\(id\) ON DELETE CASCADE/i);
    expect(sql).toMatch(
      /REFERENCES public\.hobby_tags\(id\) ON DELETE CASCADE/i,
    );
    expect(sql).toMatch(
      /CHECK \(proficiency_level BETWEEN 0 AND 3\) NOT VALID/i,
    );
  });

  it('indexes catalogue filtering and both user-tag lookup paths', () => {
    expect(sql).toMatch(
      /hobby_tags_category_name_idx[\s\S]*\(category, name\)/i,
    );
    expect(sql).toMatch(/user_hobby_tags_user_id_idx/i);
    expect(sql).toMatch(/user_hobby_tags_hobby_tag_id_idx/i);
  });

  it('is replay-safe and retains the API-first database boundary', () => {
    expect(sql).toMatch(/IF NOT EXISTS/g);
    expect(sql).toMatch(
      /ALTER TABLE public\.hobby_tags ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.user_hobby_tags ENABLE ROW LEVEL SECURITY/i,
    );
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/i);
  });
});
