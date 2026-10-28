import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetRoomsQueryDto } from './get-rooms-query.dto';

describe('GetRoomsQueryDto', () => {
  it.each([
    [{}, undefined],
    [{ include_locked: 'true' }, true],
    [{ include_locked: 'false' }, false],
    [{ include_locked: true }, true],
  ])(
    'accepts the bounded room visibility query %#',
    async (input, expected) => {
      const dto = plainToInstance(GetRoomsQueryDto, input);

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto.include_locked).toBe(expected);
    },
  );

  it.each([
    { include_locked: '1' },
    { include_locked: 'yes' },
    { include_locked: '' },
    { include_locked: ['true'] },
  ])('rejects an invalid room visibility query %#', async (input) => {
    const dto = plainToInstance(GetRoomsQueryDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
