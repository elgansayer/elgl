import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CalendarEventsQueryDto } from './calendar-events-query.dto';

async function errorsFor(value: Record<string, unknown>) {
  return validate(plainToInstance(CalendarEventsQueryDto, value));
}

describe('CalendarEventsQueryDto', () => {
  it('accepts a bounded ISO date range', async () => {
    const errors = await errorsFor({
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
      limit: 100,
    });
    expect(errors).toEqual([]);
  });

  it('requires both date boundaries', async () => {
    const errors = await errorsFor({});
    expect(errors.map((error) => error.property).sort()).toEqual([
      'from_date',
      'to_date',
    ]);
  });

  it('rejects malformed dates', async () => {
    const errors = await errorsFor({
      from_date: 'not-a-date',
      to_date: 'also-not-a-date',
    });
    expect(errors.map((error) => error.property).sort()).toEqual([
      'from_date',
      'to_date',
    ]);
  });

  it('coerces query-string limits and enforces the 1 to 100 bound', async () => {
    expect(
      await errorsFor({
        from_date: '2026-08-01T00:00:00.000Z',
        to_date: '2026-08-31T23:59:59.999Z',
        limit: '100',
      }),
    ).toEqual([]);

    const tooLarge = await errorsFor({
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
      limit: '101',
    });
    expect(tooLarge.some((error) => error.property === 'limit')).toBe(true);

    const zero = await errorsFor({
      from_date: '2026-08-01T00:00:00.000Z',
      to_date: '2026-08-31T23:59:59.999Z',
      limit: '0',
    });
    expect(zero.some((error) => error.property === 'limit')).toBe(true);
  });
});
