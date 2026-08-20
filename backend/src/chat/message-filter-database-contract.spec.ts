import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadMigration(): string {
  const relativePath =
    'supabase/migrations/20260820210000_enforce_first_contact_message_filters.sql';
  const candidates = [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), '..', relativePath),
  ];
  const migrationPath = candidates.find((candidate) => existsSync(candidate));

  if (!migrationPath) {
    throw new Error(`Unable to locate ${relativePath}`);
  }

  return readFileSync(migrationPath, 'utf8');
}

describe('first-contact message filter database contract', () => {
  const migration = loadMigration();

  it('validates persisted message-filter shape and age ordering', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.validate_message_filters_jsonb',
    );
    expect(migration).toContain('users_message_filters_valid');
    expect(migration).toContain('age_min_value > age_max_value');
    expect(migration).toContain("'male', 'female', 'other'");
  });

  it('enforces filters only for the first message in a direct room', () => {
    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.enforce_first_contact_message_filters',
    );
    expect(migration).toContain('FROM public.chat_messages existing');
    expect(migration).toContain('IF other_member_count <> 1 THEN');
    expect(migration).toContain(
      'DROP TRIGGER IF EXISTS enforce_first_contact_message_filters ON public.chat_messages',
    );
  });

  it('fails closed when an active filter depends on missing sender data', () => {
    expect(migration).toContain('sender_native_languages IS NULL');
    expect(migration).toContain('sender_age IS NULL OR sender_age < age_min_value');
    expect(migration).toContain('sender_age IS NULL OR sender_age > age_max_value');
    expect(migration).toContain('sender_gender IS NULL');
  });

  it('does not disclose the recipient policy in rejection errors', () => {
    const rejection = 'Initial message is not allowed by recipient message filters';
    expect(migration.match(new RegExp(rejection, 'g'))?.length).toBe(4);
    expect(migration).not.toContain('age filter settings');
    expect(migration).not.toContain('gender filter settings');
    expect(migration).not.toContain('native language filter settings');
  });

  it('pins the security-definer search path and removes public execution', () => {
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = public');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.enforce_first_contact_message_filters() FROM PUBLIC',
    );
  });
});
