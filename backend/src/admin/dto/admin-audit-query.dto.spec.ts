import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminAuditQueryDto } from './admin-audit-query.dto';

describe('AdminAuditQueryDto', () => {
  it('accepts bounded exact-match investigation filters', async () => {
    const dto = plainToInstance(AdminAuditQueryDto, {
      action: 'users.read',
      outcome: 'success',
      capabilityKey: 'users.read',
      reasonCode: 'operator_review',
      actorUserId: 'actor-1',
      targetType: 'user',
      targetId: 'target-1',
      correlationId: 'request-1',
      startTime: '2026-08-15T20:00:00.000Z',
      endTime: '2026-08-15T21:00:00.000Z',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['action', 121],
    ['capabilityKey', 121],
    ['reasonCode', 81],
    ['actorUserId', 129],
    ['targetType', 81],
    ['targetId', 129],
    ['correlationId', 129],
  ])('rejects overlong %s filters', async (field, length) => {
    const dto = plainToInstance(AdminAuditQueryDto, {
      [field]: 'x'.repeat(length),
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
