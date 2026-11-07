import { randomUUID } from 'node:crypto';

/**
 * Local-development seed rows for live-room text chat.
 *
 * Column names follow
 * supabase/migrations/20261103090000_audio_room_chat_messages.sql.
 * `audio-room-chat.spec.ts` keeps this builder and the migration in step so
 * seeded data never silently fails against the real schema.
 */

export interface SeedRoomChatPerson {
  id: string;
  displayName: string;
}

export interface SeedRoomChatInput {
  roomId: string;
  host: SeedRoomChatPerson;
  partner: SeedRoomChatPerson;
  /** Time of the newest message. Earlier messages precede it by one minute each. */
  now?: Date;
}

/** Row for `audio_room_participants`, which gates reading and sending. */
export interface SeedRoomParticipant {
  room_id: string;
  user_id: string;
}

/** Row for `audio_room_messages`. */
export interface SeedRoomChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  client_message_id: string;
  text_content: string;
  created_at: string;
}

export interface SeedRoomChat {
  participants: SeedRoomParticipant[];
  /** Oldest first. */
  messages: SeedRoomChatMessage[];
}

const SEED_CONVERSATION: ReadonlyArray<{
  speaker: 'host' | 'partner';
  text: string;
}> = [
  {
    speaker: 'host',
    text: 'Welcome everyone! Today we are practising how to order food in a restaurant.',
  },
  { speaker: 'partner', text: 'Thank you! May I try a sentence?' },
  {
    speaker: 'host',
    text: 'Of course. Go ahead, and we will polish it together.',
  },
];

const MINUTE_MS = 60_000;

/**
 * Builds a short conversation between a room's host and one other participant,
 * plus the participant rows that let both read and send in the room. The
 * host's and partner's messages alternate, so a freshly seeded room renders a
 * populated chat overlay straight away.
 */
export function buildSeedRoomChat(input: SeedRoomChatInput): SeedRoomChat {
  const { roomId, host, partner } = input;
  const newest = (input.now ?? new Date()).getTime();

  const messages = SEED_CONVERSATION.map((line, index) => {
    const sender = line.speaker === 'host' ? host : partner;
    const minutesAgo = SEED_CONVERSATION.length - 1 - index;
    return {
      id: randomUUID(),
      room_id: roomId,
      sender_id: sender.id,
      sender_name: sender.displayName,
      client_message_id: randomUUID(),
      text_content: line.text,
      created_at: new Date(newest - minutesAgo * MINUTE_MS).toISOString(),
    };
  });

  return {
    participants: [
      { room_id: roomId, user_id: host.id },
      { room_id: roomId, user_id: partner.id },
    ],
    messages,
  };
}
