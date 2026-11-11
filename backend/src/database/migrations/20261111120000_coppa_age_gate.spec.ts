import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20261111120000_coppa_age_gate.sql',
);

describe('COPPA age-gate migration (#2044)', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');

  it('is additive and retry-safe', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS date_of_birth DATE/i);
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS age_gate_completed_at TIMESTAMPTZ/i,
    );
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.age_gate_events/i);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.age_gate_lockouts/i,
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.protect_age_gate_columns/i,
    );
    expect(sql).toMatch(
      /DROP TRIGGER IF EXISTS users_protect_age_gate_columns/i,
    );
    // Rollback steps live in comments only; nothing destructive is executed.
    const executable = sql.replace(/--.*$/gm, '');
    expect(executable).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });

  it('grandfathers existing accounts as legacy and gates every new account', () => {
    const addColumn = sql.indexOf(
      "ADD COLUMN IF NOT EXISTS age_gate_status TEXT NOT NULL DEFAULT 'legacy'",
    );
    const setDefault = sql.indexOf(
      "ALTER COLUMN age_gate_status SET DEFAULT 'required'",
    );

    expect(addColumn).toBeGreaterThanOrEqual(0);
    expect(setDefault).toBeGreaterThan(addColumn);
  });

  it('constrains the status and keeps the data-minimisation invariants', () => {
    expect(sql).toMatch(
      /CHECK \(age_gate_status IN \('legacy', 'required', 'passed', 'blocked_under_age'\)\)\s+NOT VALID/i,
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT users_age_gate_status_check/i);
    expect(sql).toMatch(
      /age_gate_status <> 'blocked_under_age' OR date_of_birth IS NULL/i,
    );
    expect(sql).toMatch(
      /age_gate_status <> 'passed'\s+OR \(date_of_birth IS NOT NULL AND age_gate_completed_at IS NOT NULL\)/i,
    );
    expect(sql).toMatch(
      /VALIDATE CONSTRAINT users_age_gate_consistency_check/i,
    );
  });

  it('blocks accounts with a self-declared age under 13 without scheduling erasure itself', () => {
    const update =
      /UPDATE public\.users\s+SET age_gate_status = 'blocked_under_age'[\s\S]*?;/i.exec(
        sql,
      )?.[0];

    expect(update).toBeDefined();
    expect(update).toMatch(/WHERE age BETWEEN 1 AND 12/i);
    expect(update).toMatch(/AND age_gate_status IN \('legacy', 'required'\)/i);
    expect(update).toMatch(/age = NULL/i);
    expect(update).toMatch(/privacy_hide_from_search = true/i);
    expect(update).not.toMatch(
      /is_deletion_pending|scheduled_for_deletion_at/i,
    );
  });

  it('stops browser roles from changing the gate columns or a verified age', () => {
    expect(sql).toMatch(
      /IF current_user NOT IN \('anon', 'authenticated'\) THEN\s+RETURN NEW;/i,
    );
    expect(sql).toMatch(
      /NEW\.age_gate_status IS DISTINCT FROM OLD\.age_gate_status/i,
    );
    expect(sql).toMatch(
      /NEW\.date_of_birth IS DISTINCT FROM OLD\.date_of_birth/i,
    );
    expect(sql).toMatch(
      /OLD\.date_of_birth IS NOT NULL AND NEW\.age IS DISTINCT FROM OLD\.age/i,
    );
    expect(sql).toMatch(/USING ERRCODE = '42501'/i);
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE ON public\.users/i);
    expect(sql).toMatch(
      /IF TG_OP = 'INSERT' THEN\s+NEW\.age_gate_status := 'required';/i,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.protect_age_gate_columns\(\)\s+FROM PUBLIC, anon, authenticated/i,
    );
  });

  it('keeps outcome rows free of personal data and independent of account lifetime', () => {
    const events =
      /CREATE TABLE IF NOT EXISTS public\.age_gate_events \([\s\S]*?\);/i.exec(
        sql,
      )?.[0] ?? '';

    expect(events).toMatch(/subject_id UUID,/);
    expect(events).not.toMatch(/REFERENCES/i);
    expect(events).not.toMatch(/email|date_of_birth|display_name/i);
  });

  it('stores only a keyed hash for lockouts', () => {
    expect(sql).toMatch(
      /identifier_hash TEXT PRIMARY KEY CHECK \(identifier_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/i,
    );
    expect(sql).toMatch(/locked_until TIMESTAMPTZ NOT NULL/i);
  });

  it('keeps both new tables unreachable for browser roles', () => {
    for (const table of ['age_gate_events', 'age_gate_lockouts']) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`,
          'i',
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated`,
          'i',
        ),
      );
      expect(sql).toMatch(
        new RegExp(
          `GRANT [A-Z, ]+ ON TABLE public\\.${table} TO service_role`,
          'i',
        ),
      );
      expect(sql).not.toMatch(new RegExp(`CREATE POLICY[^;]*${table}`, 'i'));
    }
  });

  it('never grants admin authority through row level security', () => {
    expect(sql).not.toMatch(/is_admin/i);
  });

  it('documents rollback and indexes the sweep query', () => {
    expect(sql).toMatch(/Rollback:/);
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS users_age_gate_blocked_idx[\s\S]*?WHERE age_gate_status = 'blocked_under_age'/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS age_gate_lockouts_locked_until_idx/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS age_gate_events_created_idx/i,
    );
  });
});
