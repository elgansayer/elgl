import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260826140000_harden_proficiency_level_contract.sql',
);

function loadMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8');
}

describe('profile proficiency level migration (#1458)', () => {
  let sql: string;

  beforeAll(() => {
    sql = loadMigration();
  });

  it('keeps proficiency optional instead of inventing a default level', () => {
    expect(sql).toMatch(/proficiency_level IS NULL/);
    expect(sql).not.toMatch(/SET DEFAULT\s+'(?:A1|A2|B1|B2|C1|C2)'/i);
  });

  it('normalizes supported mixed-case CEFR values before enforcing the constraint', () => {
    expect(sql).toMatch(
      /SET proficiency_level = upper\(btrim\(proficiency_level\)\)/,
    );
    expect(sql).toMatch(
      /upper\(btrim\(proficiency_level\)\) IN \('A1', 'A2', 'B1', 'B2', 'C1', 'C2'\)/,
    );
    expect(sql).toMatch(
      /USING upper\(btrim\(proficiency_level\)\)::varchar\(2\)/,
    );
  });

  it('fails closed when unexpected persisted values exist', () => {
    expect(sql).toMatch(/RAISE EXCEPTION/);
    expect(sql).toMatch(/unsupported values/);
    expect(sql).toMatch(/ERRCODE = '23514'/);
  });

  it('validates a database guard before narrowing the column', () => {
    const preflightValidation = sql.indexOf(
      'VALIDATE CONSTRAINT users_proficiency_level_preflight_check',
    );
    const narrowing = sql.indexOf(
      'ALTER COLUMN proficiency_level TYPE varchar(2)',
    );

    expect(sql).toMatch(
      /ADD CONSTRAINT users_proficiency_level_preflight_check[\s\S]*upper\(btrim\(proficiency_level\)\)/,
    );
    expect(preflightValidation).toBeGreaterThan(-1);
    expect(narrowing).toBeGreaterThan(preflightValidation);
    expect(sql).toMatch(
      /DROP CONSTRAINT users_proficiency_level_preflight_check;/,
    );
  });

  it('restricts the column to the six canonical CEFR levels', () => {
    expect(sql).toMatch(/ALTER COLUMN proficiency_level TYPE varchar\(2\)/i);
    expect(sql).toMatch(/ADD CONSTRAINT users_proficiency_level_check/);
    expect(sql).toMatch(
      /proficiency_level IN \('A1', 'A2', 'B1', 'B2', 'C1', 'C2'\)/,
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT users_proficiency_level_check/);
  });

  it('does not emit learner proficiency values to database logs', () => {
    expect(sql).not.toMatch(/RAISE\s+(?:LOG|NOTICE|INFO|WARNING)/i);
  });
});
