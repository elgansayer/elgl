import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SimplifyDto } from './simplify.dto';

describe('SimplifyDto', () => {
  it('trims valid learner text before it reaches the LLM boundary', async () => {
    const dto = plainToInstance(SimplifyDto, {
      text: '  Although it was raining, we decided to continue.  ',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto.text).toBe('Although it was raining, we decided to continue.');
  });

  it('rejects whitespace-only text after trimming', async () => {
    const dto = plainToInstance(SimplifyDto, { text: '   \n\t  ' });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'text')).toBe(true);
  });

  it('accepts text at the 4000-character API boundary', async () => {
    const dto = plainToInstance(SimplifyDto, { text: 'a'.repeat(4000) });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects text above the 4000-character API boundary', async () => {
    const dto = plainToInstance(SimplifyDto, { text: 'a'.repeat(4001) });
    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'text')).toBe(true);
  });

  it.each([null, undefined, 42, {}, []])(
    'rejects non-string input %o',
    async (text) => {
      const dto = plainToInstance(SimplifyDto, { text });
      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'text')).toBe(true);
    },
  );
});
