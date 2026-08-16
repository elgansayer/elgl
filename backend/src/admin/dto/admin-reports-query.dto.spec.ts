import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminReportsQueryDto } from './admin-reports-query.dto';

describe('AdminReportsQueryDto', () => {
  it('accepts bounded exact moderation filters', async () => {
    const dto = plainToInstance(AdminReportsQueryDto, {
      status: 'open',
      reasonCategory: 'harassment',
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['status', 41],
    ['reasonCategory', 81],
  ])('rejects an overlong %s filter', async (field, length) => {
    const dto = plainToInstance(AdminReportsQueryDto, {
      [field]: 'x'.repeat(length),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
