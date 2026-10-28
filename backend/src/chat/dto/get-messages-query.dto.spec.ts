import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetMessagesQueryDto } from './get-messages-query.dto';

describe('GetMessagesQueryDto', () => {
  it('defaults to the newest 100 messages with no cursor or search', async () => {
    const dto = plainToInstance(GetMessagesQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(100);
    expect(dto.before).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('trims search text and transforms a bounded limit and ISO cursor', async () => {
    const dto = plainToInstance(GetMessagesQueryDto, {
      search: '  hello  ',
      before: '2026-08-25T12:00:00.123456+00:00',
      limit: '25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.search).toBe('hello');
    expect(dto.before).toBe('2026-08-25T12:00:00.123456+00:00');
    expect(dto.limit).toBe(25);
  });

  it.each([
    { limit: '0' },
    { limit: '101' },
    { limit: 'many' },
    { before: 'yesterday' },
    { before: '2026-02-30T00:00:00Z' },
    { before: "2026-08-25T12:00:00Z'); DROP TABLE chat_messages;--" },
    { search: 'x'.repeat(201) },
  ])('rejects invalid query %#', async (input) => {
    const dto = plainToInstance(GetMessagesQueryDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
