import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchMessagesQueryDto } from './search-messages-query.dto';

describe('SearchMessagesQueryDto', () => {
  it('trims text inputs and transforms a bounded limit', async () => {
    const dto = plainToInstance(SearchMessagesQueryDto, {
      term: '  hello world  ',
      roomId: '  room-1  ',
      limit: '25',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.term).toBe('hello world');
    expect(dto.roomId).toBe('room-1');
    expect(dto.limit).toBe(25);
  });

  it('defaults the result limit to 50', async () => {
    const dto = plainToInstance(SearchMessagesQueryDto, { term: 'hello' });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.limit).toBe(50);
  });

  it.each([
    { term: 'x' },
    { term: 'x'.repeat(201) },
    { term: 'hello', roomId: '   ' },
    { term: 'hello', limit: '0' },
    { term: 'hello', limit: '101' },
    { term: 'hello', limit: 'not-a-number' },
  ])('rejects invalid search query %#', async (input) => {
    const dto = plainToInstance(SearchMessagesQueryDto, input);

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
