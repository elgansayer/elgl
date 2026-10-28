import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarkRoomReadDto } from './mark-room-read.dto';

describe('MarkRoomReadDto', () => {
  it('accepts between 1 and 100 message ids', async () => {
    const one = plainToInstance(MarkRoomReadDto, { message_ids: ['m-1'] });
    const max = plainToInstance(MarkRoomReadDto, {
      message_ids: Array.from({ length: 100 }, (_, index) => `m-${index}`),
    });

    await expect(validate(one)).resolves.toHaveLength(0);
    await expect(validate(max)).resolves.toHaveLength(0);
  });

  it.each([
    {},
    { message_ids: 'm-1' },
    { message_ids: [] },
    { message_ids: Array.from({ length: 101 }, (_, index) => `m-${index}`) },
    { message_ids: [''] },
    { message_ids: [42] },
    { message_ids: ['x'.repeat(129)] },
  ])('rejects invalid body %#', async (input) => {
    const dto = plainToInstance(MarkRoomReadDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
