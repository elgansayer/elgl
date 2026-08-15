import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminOperationalEventsQueryDto } from './admin-operational-events-query.dto';

describe('AdminOperationalEventsQueryDto', () => {
  it('accepts bounded operational-event investigation filters', async () => {
    const dto = plainToInstance(AdminOperationalEventsQueryDto, {
      page: 2,
      pageSize: 50,
      severity: 'warning',
      category: 'database',
      source: 'admin-v1',
      correlationId: 'request-1',
      startTime: '2026-08-15T20:00:00.000Z',
      endTime: '2026-08-15T21:00:00.000Z',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    [{ page: 0 }, 'page'],
    [{ pageSize: 101 }, 'pageSize'],
    [{ severity: 'critical' }, 'severity'],
    [{ category: 'x'.repeat(81) }, 'category'],
    [{ source: 'x'.repeat(81) }, 'source'],
    [{ correlationId: 'x'.repeat(129) }, 'correlationId'],
    [{ startTime: 'not-a-date' }, 'startTime'],
    [{ endTime: 'not-a-date' }, 'endTime'],
  ])('rejects invalid query input %#', async (input, property) => {
    const dto = plainToInstance(AdminOperationalEventsQueryDto, input);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === property)).toBe(true);
  });
});
