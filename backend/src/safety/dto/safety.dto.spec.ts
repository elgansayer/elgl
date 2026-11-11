import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportUserDto } from './safety.dto';

const base = { reported_id: 'user-1', reason_category: 'harassment' };

describe('safety ReportUserDto', () => {
  it('accepts a profile report without a Moment', async () => {
    const dto = plainToInstance(ReportUserDto, base);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('accepts a flagged Moment identified by UUID', async () => {
    const dto = plainToInstance(ReportUserDto, {
      ...base,
      moment_id: '77777777-7777-4777-8777-777777777777',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each(['not-a-uuid', '', 42])('rejects moment_id %j', async (momentId) => {
    const dto = plainToInstance(ReportUserDto, {
      ...base,
      moment_id: momentId,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('moment_id');
  });
});
