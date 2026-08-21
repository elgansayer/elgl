import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminReportsQueryDto } from './admin-reports-query.dto';

describe('AdminReportsQueryDto', () => {
  it('accepts bounded exact moderation filters and ISO time bounds', async () => {
    const dto = plainToInstance(AdminReportsQueryDto, {
      status: 'open',
      reasonCategory: 'harassment',
      reportedUserId: 'user-1',
      reporterUserId: 'reporter-1',
      startTime: '2026-08-15T20:00:00.000Z',
      endTime: '2026-08-15T21:00:00.000Z',
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each(['startTime', 'endTime'])(
    'rejects an invalid %s timestamp',
    async (field) => {
      const dto = plainToInstance(AdminReportsQueryDto, {
        [field]: 'not-a-date',
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === field)).toBe(true);
    },
  );

  it.each([
    ['status', 41],
    ['reasonCategory', 81],
    ['reportedUserId', 129],
    ['reporterUserId', 129],
  ])('rejects an overlong %s filter', async (field, length) => {
    const dto = plainToInstance(AdminReportsQueryDto, {
      [field]: 'x'.repeat(length),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
