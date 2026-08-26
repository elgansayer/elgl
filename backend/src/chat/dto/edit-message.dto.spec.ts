import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { EditMessageDto } from './edit-message.dto';

async function validationMessages(dto: EditMessageDto): Promise<string[]> {
  const errors = await validate(dto);
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('EditMessageDto', () => {
  it('accepts bounded non-blank text', async () => {
    const dto = new EditMessageDto();
    dto.text_content = 'こんにちは';

    await expect(validationMessages(dto)).resolves.toEqual([]);
  });

  it('rejects blank text', async () => {
    const dto = new EditMessageDto();
    dto.text_content = '   ';

    await expect(validationMessages(dto)).resolves.toContain(
      'text_content must not be blank',
    );
  });

  it('rejects edits larger than the send-message text limit', async () => {
    const dto = new EditMessageDto();
    dto.text_content = 'x'.repeat(10001);

    const messages = await validationMessages(dto);
    expect(messages.some((message) => message.includes('10000'))).toBe(true);
  });

  it('bounds the legacy reply_to_id compatibility field', async () => {
    const dto = new EditMessageDto();
    dto.text_content = 'edited';
    dto.reply_to_id = 'x'.repeat(129);

    const messages = await validationMessages(dto);
    expect(messages.some((message) => message.includes('128'))).toBe(true);
  });
});
