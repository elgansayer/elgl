import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GrammarCheckDto } from './grammar-check.dto';

describe('GrammarCheckDto', () => {
  it('trims valid text and BCP 47-style language hints', async () => {
    const dto = plainToInstance(GrammarCheckDto, {
      text: '  I went yesterday.  ',
      language: '  en-GB  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.text).toBe('I went yesterday.');
    expect(dto.language).toBe('en-GB');
  });

  it('rejects empty text after trimming', async () => {
    const dto = plainToInstance(GrammarCheckDto, { text: '   ' });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'text')).toBe(true);
  });

  it('rejects text longer than the pre-send contract allows', async () => {
    const dto = plainToInstance(GrammarCheckDto, { text: 'a'.repeat(2001) });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'text')).toBe(true);
  });

  it.each(['english', 'en_US', 'en--GB', '<script>'])(
    'rejects invalid language hint %s',
    async (language) => {
      const dto = plainToInstance(GrammarCheckDto, {
        text: 'Check this.',
        language,
      });
      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'language')).toBe(true);
    },
  );
});
