import { validate } from 'class-validator';
import { CHAT_TEXT_SIZES, ChatSettingsDto } from './chat-settings.dto';

describe('ChatSettingsDto', () => {
  it.each(CHAT_TEXT_SIZES)(
    'accepts the supported %s text size',
    async (textSize) => {
      const dto = Object.assign(new ChatSettingsDto(), { textSize });

      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('rejects an unsupported text size', async () => {
    const dto = Object.assign(new ChatSettingsDto(), {
      textSize: 'extra-large',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('textSize');
  });
});
