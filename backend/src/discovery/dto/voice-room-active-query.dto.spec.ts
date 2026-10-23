import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchQueryDto } from './search-query.dto';

describe('SearchQueryDto voice_room_active', () => {
  const transform = (value: unknown) =>
    plainToInstance(SearchQueryDto, { voice_room_active: value });

  it.each([
    ['true', true],
    ['false', false],
    [true, true],
    [false, false],
  ])('accepts %p as %p', async (input, expected) => {
    const dto = transform(input);

    expect(dto.voice_room_active).toBe(expected);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['yes', '1', 'TRUE', '', 1, 0, null])(
    'rejects malformed value %p instead of silently disabling the filter',
    async (input) => {
      const errors = await validate(transform(input));

      expect(
        errors.some((error) => error.property === 'voice_room_active'),
      ).toBe(true);
    },
  );

  it('keeps the filter optional when omitted', async () => {
    const dto = plainToInstance(SearchQueryDto, {});

    expect(dto.voice_room_active).toBeUndefined();
    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
