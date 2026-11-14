import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ImportChatBackupDto,
  MAX_IMPORT_MESSAGES,
} from './import-chat-backup.dto';

const validatePayload = (payload: unknown) =>
  validate(plainToInstance(ImportChatBackupDto, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('ImportChatBackupDto', () => {
  it('accepts an exported document message', async () => {
    const errors = await validatePayload({
      messages: [
        {
          message_type: 'text',
          text_content: 'hola',
          media_url: null,
          correction_payload: { original: 'ola' },
          sender_id: '99999999-8888-4777-8666-555555555555',
          created_at: '2026-11-01T10:00:00.000Z',
        },
      ],
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty message list', async () => {
    const errors = await validatePayload({ messages: [] });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayNotEmpty');
  });

  it(`rejects more than ${MAX_IMPORT_MESSAGES} messages`, async () => {
    const errors = await validatePayload({
      messages: Array.from({ length: MAX_IMPORT_MESSAGES + 1 }, () => ({
        text_content: 'a',
      })),
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('arrayMaxSize');
  });

  it('rejects fields outside the documented backup contract', async () => {
    const errors = await validatePayload({
      messages: [{ text_content: 'hola', is_read: true }],
    });

    expect(JSON.stringify(errors)).toContain('whitelistValidation');
  });

  it('rejects oversized message text and invalid timestamps', async () => {
    const errors = await validatePayload({
      messages: [
        { text_content: 'x'.repeat(20001) },
        { text_content: 'hola', created_at: 'yesterday' },
      ],
    });

    const serialised = JSON.stringify(errors);
    expect(serialised).toContain('maxLength');
    expect(serialised).toContain('isIso8601');
  });
});
