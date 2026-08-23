import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

describe('SendMessageDto chat media boundary', () => {
  it.each(['image', 'video'])(
    'rejects %s messages on the generic endpoint',
    async (messageType) => {
      const dto = plainToInstance(SendMessageDto, {
        room_id: 'room-123',
        message_type: messageType,
        media_url: 'https://cdn.example/chat-media/object',
      });

      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'message_type')).toBe(
        true,
      );
    },
  );

  it('keeps arbitrary message types rejected', async () => {
    const dto = plainToInstance(SendMessageDto, {
      room_id: 'room-123',
      message_type: 'uploaded_file',
      media_url: 'https://cdn.example/file',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'message_type')).toBe(
      true,
    );
  });
});
