import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('chat voice transcription migration contract', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      '../supabase/migrations/20261031110000_chat_voice_transcriptions.sql',
    ),
    'utf8',
  );

  it('adds only compatible nullable or defaulted message fields', () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS voice_transcript TEXT/i,
    );
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS voice_transcription_status TEXT NOT NULL DEFAULT 'not_requested'/i,
    );
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS voice_transcription_attempts INTEGER NOT NULL DEFAULT 0/i,
    );
    expect(migration).not.toMatch(/DROP COLUMN/i);
  });

  it('constrains every externally visible worker state and retry count', () => {
    for (const status of [
      'not_requested',
      'pending',
      'processing',
      'ready',
      'empty',
      'failed',
      'unavailable',
    ]) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toMatch(/CHECK \(voice_transcription_attempts >= 0\)/i);
  });

  it('indexes only the bounded pending worker population', () => {
    expect(migration).toMatch(
      /chat_messages_voice_transcription_queue_idx[\s\S]*voice_transcription_status[\s\S]*voice_transcription_next_retry_at[\s\S]*WHERE voice_transcription_status IN \('pending', 'failed'\)/i,
    );
  });

  it('documents parent-message retention and sanitised failures', () => {
    expect(migration).toContain(
      'It follows the parent message retention and deletion lifecycle.',
    );
    expect(migration).toContain(
      'Never stores transcript or provider response content.',
    );
  });
});
