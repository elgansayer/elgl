import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
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

  it('strips null bytes from text_content during transformation', async () => {
    const dto = plainToInstance(EditMessageDto, {
      text_content: 'test\u0000edit',
    });
    const messages = await validationMessages(dto);
    expect(messages).toEqual([]);
    expect(dto.text_content).toBe('testedit');
  });

  it('rejects text_content that becomes blank after stripping null bytes', async () => {
    const dto = plainToInstance(EditMessageDto, {
      text_content: '\u0000   \u0000',
    });
    const messages = await validationMessages(dto);
    expect(messages).toContain('text_content must not be blank');
  });
});
