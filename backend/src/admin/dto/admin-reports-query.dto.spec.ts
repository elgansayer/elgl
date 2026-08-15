import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminReportsQueryDto } from './admin-reports-query.dto';

describe('AdminReportsQueryDto', () => {
  it('accepts a bounded exact status filter', async () => {
    const dto = plainToInstance(AdminReportsQueryDto, { status: 'open' });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects an overlong status filter', async () => {
    const dto = plainToInstance(AdminReportsQueryDto, {
      status: 'x'.repeat(41),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });
});
