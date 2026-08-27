import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(process.cwd(), '..');
const migration = readFileSync(
  resolve(
    repositoryRoot,
    'supabase/migrations/20260827123000_harden_private_party_service_boundary.sql',
  ),
  'utf8',
);

describe('Private Party database boundary', () => {
  it('requires bounded invite state for every newly written private room', () => {
    expect(migration).toMatch(/audio_rooms_private_invites_valid/i);
    expect(migration).toMatch(
      /COALESCE\(is_private, false\) = false[\s\S]*cardinality\(invited_user_ids\)[\s\S]*= 0/i,
    );
    expect(migration).toMatch(
      /is_private = true[\s\S]*cardinality\(invited_user_ids\)[\s\S]*BETWEEN 1 AND 50/i,
    );
    expect(migration).toMatch(/ADD CONSTRAINT[\s\S]*NOT VALID/i);
  });

  it('prevents authenticated direct clients from creating private rooms', () => {
    const insertPolicy = migration.match(
      /CREATE POLICY audio_rooms_insert_own[\s\S]*?;\n/i,
    )?.[0];

    expect(insertPolicy).toBeDefined();
    expect(insertPolicy).toMatch(/FOR INSERT TO authenticated/i);
    expect(insertPolicy).toMatch(/auth\.uid\(\) = host_id/i);
    expect(insertPolicy).toMatch(/COALESCE\(is_private, false\) = false/i);
    expect(insertPolicy).toMatch(/cardinality\(invited_user_ids\)[\s\S]*= 0/i);
  });

  it('prevents authenticated direct clients from promoting or mutating private rooms', () => {
    const updatePolicy = migration.match(
      /CREATE POLICY audio_rooms_update_own[\s\S]*?;\n/i,
    )?.[0];

    expect(updatePolicy).toBeDefined();
    expect(updatePolicy).toMatch(/FOR UPDATE TO authenticated/i);
    expect(updatePolicy).toMatch(/auth\.uid\(\) = host_id OR auth\.uid\(\) = co_host_id/i);
    expect(updatePolicy).toMatch(/COALESCE\(is_archived, false\) = false/i);
    expect(updatePolicy?.match(/COALESCE\(is_private, false\) = false/gi)).toHaveLength(2);
    expect(updatePolicy).toMatch(/cardinality\(invited_user_ids\)[\s\S]*= 0/i);
  });

  it('keeps private room discovery limited to the room relationship or admins', () => {
    const selectPolicy = migration.match(
      /CREATE POLICY audio_rooms_select_authenticated[\s\S]*?;\n/i,
    )?.[0];

    expect(selectPolicy).toBeDefined();
    expect(selectPolicy).toMatch(/FOR SELECT TO authenticated/i);
    expect(selectPolicy).toMatch(/COALESCE\(is_private, false\) = false/i);
    expect(selectPolicy).toMatch(/auth\.uid\(\) = host_id/i);
    expect(selectPolicy).toMatch(/auth\.uid\(\) = co_host_id/i);
    expect(selectPolicy).toMatch(/auth\.uid\(\) = ANY \(invited_user_ids\)/i);
    expect(selectPolicy).toMatch(/u\.is_admin = true/i);
    expect(selectPolicy).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });
});
