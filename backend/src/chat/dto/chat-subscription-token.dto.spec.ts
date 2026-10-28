import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CHAT_SUBSCRIPTION_STREAMS,
  ChatSubscriptionTokenDto,
} from './chat-subscription-token.dto';

const ROOM_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('ChatSubscriptionTokenDto', () => {
  it.each(CHAT_SUBSCRIPTION_STREAMS)(
    'accepts a room UUID for the %s stream',
    async (stream) => {
      const dto = plainToInstance(ChatSubscriptionTokenDto, {
        room_id: ROOM_ID,
        stream,
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('only offers the streams the chat namespace exposes', () => {
    expect([...CHAT_SUBSCRIPTION_STREAMS]).toEqual(['messages', 'typing']);
  });

  it.each([
    {},
    { room_id: ROOM_ID },
    { stream: 'messages' },
    { room_id: 'not-a-uuid', stream: 'messages' },
    { room_id: `${ROOM_ID}:typing`, stream: 'messages' },
    { room_id: ROOM_ID, stream: 'presence' },
    { room_id: ROOM_ID, stream: 'user_other' },
    { room_id: ROOM_ID, stream: ['messages'] },
    { room_id: ROOM_ID, stream: 1 },
    { room_id: 42, stream: 'typing' },
  ])('rejects invalid body %#', async (input) => {
    const dto = plainToInstance(ChatSubscriptionTokenDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
