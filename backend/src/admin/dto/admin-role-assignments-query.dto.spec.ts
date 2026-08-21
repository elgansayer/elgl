import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminRoleAssignmentsQueryDto } from './admin-role-assignments-query.dto';

describe('AdminRoleAssignmentsQueryDto', () => {
  it('accepts bounded exact role-assignment filters', async () => {
    const dto = plainToInstance(AdminRoleAssignmentsQueryDto, {
      userId: 'user-1',
      roleKey: 'support',
    });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['userId', 129],
    ['roleKey', 81],
  ])('rejects overlong %s filters', async (field, length) => {
    const dto = plainToInstance(AdminRoleAssignmentsQueryDto, {
      [field]: 'x'.repeat(length),
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
