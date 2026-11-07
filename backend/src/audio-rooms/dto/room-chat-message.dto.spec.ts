import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListRoomChatMessagesQueryDto,
  SendRoomChatMessageDto,
} from './room-chat-message.dto';

describe('room chat message DTOs', () => {
  it('accepts a bounded text message with a UUID retry key', async () => {
    const dto = plainToInstance(SendRoomChatMessageDto, {
      client_message_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      text_content: 'Could you explain that phrase again?',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects blank, oversized and non-idempotent message submissions', async () => {
    const blank = plainToInstance(SendRoomChatMessageDto, {
      client_message_id: 'not-a-uuid',
      text_content: '   ',
    });
    const oversized = plainToInstance(SendRoomChatMessageDto, {
      client_message_id: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
      text_content: 'x'.repeat(1001),
    });

    expect((await validate(blank)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['client_message_id', 'text_content']),
    );
    expect(
      (await validate(oversized)).map((error) => error.property),
    ).toContain('text_content');
  });

  it('coerces and bounds history pagination', async () => {
    const valid = plainToInstance(ListRoomChatMessagesQueryDto, {
      limit: '25',
      offset: '50',
    });
    const invalid = plainToInstance(ListRoomChatMessagesQueryDto, {
      limit: '101',
      offset: '-1',
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    expect(valid).toMatchObject({ limit: 25, offset: 50 });
    expect((await validate(invalid)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['limit', 'offset']),
    );
  });
});
