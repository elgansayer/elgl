import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendChatMediaMessageDto } from './send-chat-media-message.dto';

const NONCE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const ROOM_ID = '3f2a1c5e-8d4b-4e6a-9b7c-1d2e3f4a5b6c';

async function propertiesWithErrors(
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(
    plainToInstance(SendChatMediaMessageDto, payload),
  );
  return errors.map((error) => error.property).sort();
}

describe('SendChatMediaMessageDto', () => {
  it.each([
    ['image', `chat-media/user-1/image/standard/1730000000000-${NONCE}.jpg`],
    ['image', `chat-media/user-1/image/hd/1730000000000-${NONCE}.png`],
    ['video', `chat-media/user-1/video/hd/1730000000000-${NONCE}.mp4`],
    ['doodle', `chat-media/user-1/doodle/standard/1730000000000-${NONCE}.png`],
  ])('accepts a server-issued %s key', async (mediaKind, objectKey) => {
    await expect(
      propertiesWithErrors({ roomId: ROOM_ID, mediaKind, objectKey }),
    ).resolves.toEqual([]);
  });

  it.each([
    [
      'a doodle with a photo extension',
      `chat-media/user-1/doodle/standard/1-${NONCE}.jpg`,
    ],
    [
      'a doodle with a video extension',
      `chat-media/user-1/doodle/standard/1-${NONCE}.mp4`,
    ],
    ['an HD doodle', `chat-media/user-1/doodle/hd/1-${NONCE}.png`],
    [
      'a doodle with a short nonce',
      'chat-media/user-1/doodle/standard/1-abc.png',
    ],
    [
      'a doodle with an uppercase nonce',
      `chat-media/user-1/doodle/standard/1-${NONCE.toUpperCase()}.png`,
    ],
    [
      'a key outside the chat-media folder',
      `doodles/user-1/standard/1-${NONCE}.png`,
    ],
    [
      'a traversal attempt',
      `chat-media/user-1/doodle/standard/../../other/1-${NONCE}.png`,
    ],
    [
      'an absolute URL',
      `https://evil.example/chat-media/user-1/doodle/standard/1-${NONCE}.png`,
    ],
    [
      'a trailing path',
      `chat-media/user-1/doodle/standard/1-${NONCE}.png/extra`,
    ],
  ])('rejects %s', async (_label, objectKey) => {
    await expect(
      propertiesWithErrors({
        roomId: ROOM_ID,
        mediaKind: 'doodle',
        objectKey,
      }),
    ).resolves.toEqual(['objectKey']);
  });

  it('rejects an unsupported media kind', async () => {
    await expect(
      propertiesWithErrors({
        roomId: ROOM_ID,
        mediaKind: 'sticker',
        objectKey: `chat-media/user-1/doodle/standard/1-${NONCE}.png`,
      }),
    ).resolves.toEqual(['mediaKind']);
  });

  it.each([
    ['a non-UUID identifier', 'room-1'],
    ['an empty identifier', ''],
    ['an over-long identifier', 'r'.repeat(129)],
    ['a UUID with trailing text', `${ROOM_ID}; select 1`],
    ['a number', 7],
  ])(
    'requires the room to be a UUID and rejects %s',
    async (_label, roomId) => {
      await expect(
        propertiesWithErrors({
          roomId,
          mediaKind: 'doodle',
          objectKey: `chat-media/user-1/doodle/standard/1-${NONCE}.png`,
        }),
      ).resolves.toEqual(['roomId']);
    },
  );

  it('only allows the documented presentations', async () => {
    const base = {
      roomId: ROOM_ID,
      mediaKind: 'video',
      objectKey: `chat-media/user-1/video/standard/1-${NONCE}.webm`,
    };

    await expect(
      propertiesWithErrors({ ...base, presentation: 'instant_video' }),
    ).resolves.toEqual([]);
    await expect(
      propertiesWithErrors({ ...base, presentation: 'fullscreen' }),
    ).resolves.toEqual(['presentation']);
  });
});
