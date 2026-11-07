import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSeedRoomChat } from './audio-room-chat';

const repositoryRoot = resolve(process.cwd(), '..');
const read = (relativePath: string): string =>
  readFileSync(resolve(repositoryRoot, relativePath), 'utf8');

const messagesMigration = read(
  'supabase/migrations/20261103090000_audio_room_chat_messages.sql',
);
const participantsMigration = read(
  'supabase/migrations/20260820190000_audio_room_session_summary_workflow.sql',
);
const seedSource = read('backend/src/database/seed.ts');

interface TableColumns {
  all: string[];
  /** Columns that are NOT NULL and have no default, so a seed row must set them. */
  required: string[];
}

/** Columns declared by one `CREATE TABLE IF NOT EXISTS public.<table>` statement. */
function tableColumns(sql: string, table: string): TableColumns {
  const body = sql
    .replace(/--.*$/gm, '')
    .match(
      new RegExp(
        `CREATE TABLE IF NOT EXISTS public\\.${table} \\(([\\s\\S]*?)\\n\\);`,
      ),
    );
  if (!body) {
    throw new Error(`CREATE TABLE IF NOT EXISTS public.${table} not found`);
  }

  const columnLines = body[1]
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(
      (line) =>
        line.length > 0 &&
        !/^(CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK)\b/i.test(line),
    );

  return {
    all: columnLines.map((line) => line.split(/\s+/)[0]),
    required: columnLines
      .filter(
        (line) => /\bNOT NULL\b/i.test(line) && !/\bDEFAULT\b/i.test(line),
      )
      .map((line) => line.split(/\s+/)[0]),
  };
}

const people = {
  roomId: '4d72ae50-6153-4c54-a638-334fe24ab7e2',
  host: { id: 'host-user', displayName: 'Oliver Smith' },
  partner: { id: 'partner-user', displayName: 'Sofia Garcia' },
};

describe('buildSeedRoomChat', () => {
  const now = new Date('2026-11-03T10:00:00.000Z');
  const chat = buildSeedRoomChat({ ...people, now });

  it('records the host and the partner as participants of the room', () => {
    expect(chat.participants).toEqual([
      { room_id: people.roomId, user_id: 'host-user' },
      { room_id: people.roomId, user_id: 'partner-user' },
    ]);
  });

  it('alternates the host and the partner, oldest first, one minute apart', () => {
    expect(chat.messages.map((message) => message.sender_id)).toEqual([
      'host-user',
      'partner-user',
      'host-user',
    ]);
    expect(chat.messages.map((message) => message.sender_name)).toEqual([
      'Oliver Smith',
      'Sofia Garcia',
      'Oliver Smith',
    ]);
    expect(chat.messages.map((message) => message.created_at)).toEqual([
      '2026-11-03T09:58:00.000Z',
      '2026-11-03T09:59:00.000Z',
      '2026-11-03T10:00:00.000Z',
    ]);
    expect(
      chat.messages.every((message) => message.room_id === people.roomId),
    ).toBe(true);
  });

  it('gives every message its own id and retry key', () => {
    const ids = chat.messages.flatMap((message) => [
      message.id,
      message.client_message_id,
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('seeded live-room chat against the migrations', () => {
  const chat = buildSeedRoomChat({ ...people });
  const messageColumns = tableColumns(messagesMigration, 'audio_room_messages');
  const participantColumns = tableColumns(
    participantsMigration,
    'audio_room_participants',
  );

  it('only sets columns that audio_room_messages declares and sets every required one', () => {
    for (const message of chat.messages) {
      const keys = Object.keys(message);
      expect(keys.filter((key) => !messageColumns.all.includes(key))).toEqual(
        [],
      );
      expect(
        messageColumns.required.filter((column) => !keys.includes(column)),
      ).toEqual([]);
    }
  });

  it('only sets columns that audio_room_participants declares and sets every required one', () => {
    for (const participant of chat.participants) {
      const keys = Object.keys(participant);
      expect(
        keys.filter((key) => !participantColumns.all.includes(key)),
      ).toEqual([]);
      expect(
        participantColumns.required.filter((column) => !keys.includes(column)),
      ).toEqual([]);
    }
  });

  it('stays inside the text and sender name bounds the migration enforces', () => {
    const bounds = messagesMigration.match(/BETWEEN (\d+) AND (\d+)/);
    const senderLimit = messagesMigration.match(/sender_name VARCHAR\((\d+)\)/);
    if (!bounds || !senderLimit) {
      throw new Error('The migration no longer declares the checked bounds.');
    }

    for (const message of chat.messages) {
      const length = [...message.text_content.trim()].length;
      expect(length).toBeGreaterThanOrEqual(Number(bounds[1]));
      expect(length).toBeLessThanOrEqual(Number(bounds[2]));
      expect([...message.sender_name].length).toBeLessThanOrEqual(
        Number(senderLimit[1]),
      );
    }
  });
});

describe('seed script wiring', () => {
  it('seeds participants before messages through the shared builder', () => {
    const participantsAt = seedSource.indexOf(
      ".from('audio_room_participants')",
    );
    const messagesAt = seedSource.indexOf(".from('audio_room_messages')");

    expect(seedSource).toContain("from './data/audio-room-chat'");
    expect(seedSource).toContain('buildSeedRoomChat(');
    expect(participantsAt).toBeGreaterThan(-1);
    expect(messagesAt).toBeGreaterThan(participantsAt);
  });
});
