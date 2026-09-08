import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    process.cwd(),
    '../supabase/migrations/20260820190000_audio_room_session_summary_workflow.sql',
  ),
  'utf8',
);

describe('Audio room archive database boundary', () => {
  it('removes every historical authenticated transcript read policy', () => {
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "Authenticated users can view transcripts"/i,
    );
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS audio_room_transcripts_select_authenticated/i,
    );
  });

  it('limits transcript reads to room relationships or recorded participation', () => {
    const selectPolicy = migration.match(
      /CREATE POLICY "Room participants can view transcripts"[\s\S]*?;\n/i,
    )?.[0];

    expect(selectPolicy).toBeDefined();
    expect(selectPolicy).toMatch(/room\.host_id = auth\.uid\(\)/i);
    expect(selectPolicy).toMatch(/room\.co_host_id = auth\.uid\(\)/i);
    expect(selectPolicy).toMatch(/audio_room_participants participant/i);
    expect(selectPolicy).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it('blocks direct authenticated writes to participation history', () => {
    expect(migration).toMatch(
      /DROP POLICY IF EXISTS "Users can insert own audio room participation"/i,
    );
    expect(migration).not.toMatch(
      /CREATE POLICY "Users can insert own audio room participation"/i,
    );
  });
});
