import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../../../supabase/migrations/20260824032500_harden_scheduled_event_language_parties.sql',
);

describe('scheduled Event -> Language Party migration (#1331)', () => {
  let sql: string;

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('enforces one generated room per event without deleting historical rooms', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS audio_rooms_event_id_unique/);
    expect(sql).toMatch(/ON public\.audio_rooms \(event_id\)/);
    expect(sql).toMatch(/WHERE event_id IS NOT NULL/);
    expect(sql).toMatch(/SET event_id = NULL/);
    expect(sql).not.toMatch(/DELETE FROM public\.audio_rooms/i);
  });

  it('keeps event links referentially valid and non-destructive on event deletion', () => {
    expect(sql).toMatch(/ADD CONSTRAINT audio_rooms_event_id_fkey/);
    expect(sql).toMatch(/REFERENCES public\.events\(id\)/);
    expect(sql).toMatch(/ON DELETE SET NULL/);
    expect(sql).toMatch(/VALIDATE CONSTRAINT audio_rooms_event_id_fkey/);
  });

  it('prefers the deterministic event room when converging historical duplicate links', () => {
    expect(sql).toMatch(/ROW_NUMBER\(\) OVER/);
    expect(sql).toMatch(/language_party-' \|\| ar\.event_id::text/);
    expect(sql).toMatch(/r\.row_number > 1/);
  });

  it('indexes only the bounded worker candidate population', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS events_due_audio_room_idx/);
    expect(sql).toMatch(/ON public\.events \(date_time ASC, id ASC\)/);
    expect(sql).toMatch(/category = 'audio_room'/);
    expect(sql).toMatch(/is_cancelled = false/);
    expect(sql).toMatch(/language_pair IS NOT NULL/);
  });
});
