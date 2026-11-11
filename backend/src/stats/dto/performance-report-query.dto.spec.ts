import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PerformanceReportQueryDto } from './performance-report-query.dto';

function validate(input: Record<string, unknown>) {
  return validateSync(plainToInstance(PerformanceReportQueryDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('PerformanceReportQueryDto', () => {
  it('accepts a request without a period', () => {
    expect(validate({})).toHaveLength(0);
  });

  it.each(['week', 'month'])('accepts the %s period', (period) => {
    expect(validate({ period })).toHaveLength(0);
  });

  it.each(['year', 'WEEK', '', '7', 'week; DROP TABLE users'])(
    'rejects the unsupported period %j',
    (period) => {
      const errors = validate({ period });

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('period');
    },
  );

  it('rejects a non-string period', () => {
    expect(validate({ period: 7 })).toHaveLength(1);
  });

  it('rejects a caller-supplied user id so the subject stays the session', () => {
    const errors = validate({ period: 'week', userId: 'someone-else' });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('userId');
  });
});
