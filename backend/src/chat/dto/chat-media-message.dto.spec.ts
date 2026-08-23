import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

describe('SendMessageDto chat media', () => {
  it.each(['image', 'video'])('accepts a %s message with a media URL', async (messageType) => {
    const dto = plainToInstance(SendMessageDto, {
      room_id: 'room-123',
      message_type: messageType,
      media_url: 'https://cdn.example/chat-media/object',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['image', 'video'])('requires media_url for %s messages', async (messageType) => {
    const dto = plainToInstance(SendMessageDto, {
      room_id: 'room-123',
      message_type: messageType,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'media_url')).toBe(true);
  });

  it('keeps arbitrary message types rejected', async () => {
    const dto = plainToInstance(SendMessageDto, {
      room_id: 'room-123',
      message_type: 'uploaded_file',
      media_url: 'https://cdn.example/file',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'message_type')).toBe(true);
  });
});
