import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendTypingDto } from './send-typing.dto';

const ROOM_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('SendTypingDto', () => {
  it.each([true, false])(
    'accepts a room UUID and boolean %s',
    async (typing) => {
      const dto = plainToInstance(SendTypingDto, {
        room_id: ROOM_ID,
        is_typing: typing,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.is_typing).toBe(typing);
    },
  );

  it('still accepts the string form sent by older clients and turns it into a boolean', async () => {
    const started = plainToInstance(SendTypingDto, {
      room_id: ROOM_ID,
      is_typing: 'true',
    });
    const stopped = plainToInstance(SendTypingDto, {
      room_id: ROOM_ID,
      is_typing: 'false',
    });

    await expect(validate(started)).resolves.toHaveLength(0);
    await expect(validate(stopped)).resolves.toHaveLength(0);
    expect(started.is_typing).toBe(true);
    expect(stopped.is_typing).toBe(false);
  });

  it.each([
    {},
    { room_id: ROOM_ID },
    { is_typing: true },
    { room_id: 'not-a-uuid', is_typing: true },
    { room_id: `${ROOM_ID}'; DROP TABLE chat_rooms;--`, is_typing: true },
    { room_id: 42, is_typing: true },
    { room_id: ROOM_ID, is_typing: 'yes' },
    { room_id: ROOM_ID, is_typing: 1 },
    { room_id: ROOM_ID, is_typing: null },
  ])('rejects invalid body %#', async (input) => {
    const dto = plainToInstance(SendTypingDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
