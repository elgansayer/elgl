import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

async function validateMessage(payload: Record<string, unknown>) {
  return validate(plainToInstance(SendMessageDto, payload));
}

function hasError(
  errors: Awaited<ReturnType<typeof validateMessage>>,
  property: string,
): boolean {
  return errors.some((error) => error.property === property);
}

describe('SendMessageDto', () => {
  it('accepts a valid text message', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'text',
      text_content: 'Hello there',
    });

    expect(errors).toHaveLength(0);
  });

  it('requires non-blank text_content for text messages', async () => {
    const missing = await validateMessage({
      room_id: 'room-1',
      message_type: 'text',
    });
    const blank = await validateMessage({
      room_id: 'room-1',
      message_type: 'text',
      text_content: '   ',
    });

    expect(hasError(missing, 'text_content')).toBe(true);
    expect(hasError(blank, 'text_content')).toBe(true);
  });

  it('bounds text message size', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'text',
      text_content: 'x'.repeat(10001),
    });

    expect(hasError(errors, 'text_content')).toBe(true);
  });

  it.each(['voice', 'doodle', 'sticker', 'view_once_media'])(
    'requires media_url for %s messages',
    async (messageType) => {
      const errors = await validateMessage({
        room_id: 'room-1',
        message_type: messageType,
      });

      expect(hasError(errors, 'media_url')).toBe(true);
    },
  );

  it('accepts a data URL for doodles', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'doodle',
      media_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
    });

    expect(errors).toHaveLength(0);
  });

  it('requires and validates correction payloads', async () => {
    const missing = await validateMessage({
      room_id: 'room-1',
      message_type: 'correction',
    });
    const invalid = await validateMessage({
      room_id: 'room-1',
      message_type: 'correction',
      correction_payload: {
        original: '   ',
        corrected: '',
      },
    });

    expect(hasError(missing, 'correction_payload')).toBe(true);
    expect(hasError(invalid, 'correction_payload')).toBe(true);
    expect(
      invalid.find((error) => error.property === 'correction_payload')?.children
        ?.length,
    ).toBeGreaterThan(0);
  });

  it('requires a correction-request payload for correction requests', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'correction_request',
    });

    expect(hasError(errors, 'correction_request_payload')).toBe(true);
  });

  it('requires a status-reply payload for status replies', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'status_reply',
    });

    expect(hasError(errors, 'status_reply_payload')).toBe(true);
  });

  it('rejects unsupported message types', async () => {
    const errors = await validateMessage({
      room_id: 'room-1',
      message_type: 'system',
    });

    expect(hasError(errors, 'message_type')).toBe(true);
  });

  it('bounds room and reply identifiers', async () => {
    const errors = await validateMessage({
      room_id: 'r'.repeat(129),
      message_type: 'text',
      text_content: 'Hello',
      reply_to_id: 'm'.repeat(129),
    });

    expect(hasError(errors, 'room_id')).toBe(true);
    expect(hasError(errors, 'reply_to_id')).toBe(true);
  });
});
