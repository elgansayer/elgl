import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminUserQueryDto } from './admin-user-query.dto';

describe('AdminUserQueryDto', () => {
  it('accepts a bounded display-name search', async () => {
    const dto = plainToInstance(AdminUserQueryDto, { search: 'john' });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects an overlong display-name search', async () => {
    const dto = plainToInstance(AdminUserQueryDto, {
      search: 'x'.repeat(121),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'search')).toBe(true);
  });
});
