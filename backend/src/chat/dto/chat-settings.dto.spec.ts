import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CHAT_TEXT_SIZES, ChatSettingsDto } from './chat-settings.dto';

/** Validates a request body with the same options as the global pipe in src/main.ts. */
async function validationMessages(
  body: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(ChatSettingsDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('ChatSettingsDto', () => {
  describe('textSize', () => {
    it('offers the presets the Appearance page sends', () => {
      expect(CHAT_TEXT_SIZES).toEqual(['small', 'medium', 'large']);
    });

    it.each(CHAT_TEXT_SIZES)('accepts the %s preset', async (textSize) => {
      await expect(validationMessages({ textSize })).resolves.toEqual([]);
    });

    it('stays optional so other chat settings can be saved on their own', async () => {
      await expect(validationMessages({ readReceipts: true })).resolves.toEqual(
        [],
      );
      await expect(validationMessages({})).resolves.toEqual([]);
    });

    it.each([['huge'], ['LARGE'], [''], [3], [true], [['large']]])(
      'rejects the unsupported value %j',
      async (textSize) => {
        const messages = await validationMessages({ textSize });

        expect(messages).toContain(
          'textSize must be one of the following values: small, medium, large',
        );
      },
    );

    it('can be combined with the existing chat settings in one request', async () => {
      await expect(
        validationMessages({
          autoTranslate: true,
          readReceipts: false,
          enterToSend: true,
          textSize: 'small',
          disappearingMessagesTtl: '24h',
        }),
      ).resolves.toEqual([]);
    });

    it('still refuses unknown properties next to a valid text size', async () => {
      const messages = await validationMessages({
        textSize: 'large',
        userId: 'someone-else',
      });

      expect(messages).toContain('property userId should not exist');
    });
  });
});
