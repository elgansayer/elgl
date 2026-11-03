import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDirectory = resolve(process.cwd(), '..', 'supabase/migrations');
const migrationFile = '20261102120000_chat_doodle_media_idempotency.sql';
const migration = readFileSync(
  resolve(migrationsDirectory, migrationFile),
  'utf8',
);
const imageVideoMigration = readFileSync(
  resolve(migrationsDirectory, '20260823030500_chat_media_idempotency.sql'),
  'utf8',
);

function executableSql(source: string): string {
  return source.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim();
}

describe('chat doodle media idempotency migration contract', () => {
  const sql = executableSql(migration);

  it('is a single idempotent unique index and nothing else', () => {
    expect(sql).toMatch(
      /^CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_sender_doodle_media_url_unique_idx ON public\.chat_messages \(sender_id, media_url\) WHERE .*;$/,
    );
    expect(sql.match(/;/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i);
  });

  it('constrains one persisted message per sender and uploaded doodle object', () => {
    expect(sql).toContain("message_type = 'doodle'");
    expect(sql).toContain("media_url LIKE '%/chat-media/%/doodle/standard/%'");
  });

  it('never indexes legacy inline data URL doodles', () => {
    // A base64 alphabet has no hyphen, so no inline PNG can match the object-key shape.
    const predicate = /media_url LIKE '([^']+)'/.exec(sql)?.[1] ?? '';
    const pattern = new RegExp(
      `^${predicate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`,
    );

    expect(
      pattern.test('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'),
    ).toBe(false);
    expect(
      pattern.test(
        'https://cdn.example/chat-media/user-1/doodle/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
      ),
    ).toBe(true);
    expect(
      pattern.test(
        'https://cdn.example/chat-media/user-1/image/standard/1-aaaaaaaaaaaaaaaaaaaaaaaa.png',
      ),
    ).toBe(false);
  });

  it('leaves the image and video index untouched', () => {
    expect(executableSql(imageVideoMigration)).toContain(
      "message_type IN ('image', 'video')",
    );
    expect(sql).not.toContain('chat_messages_sender_media_url_unique_idx');
  });

  it('keeps a unique, timestamped id so migration history stays append-only', () => {
    const matching = readdirSync(migrationsDirectory).filter((file) =>
      file.startsWith('20261102120000_'),
    );

    expect(matching).toEqual([migrationFile]);
  });
});
