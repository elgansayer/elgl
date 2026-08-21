import { AdminRoleAssignmentsService } from './admin-role-assignments.service';
import { AdminRolesV1Controller } from './admin-roles-v1.controller';

describe('AdminRolesV1Controller', () => {
  it('delegates bounded role-assignment queries', async () => {
    const assignments = {
      list: vi.fn().mockResolvedValue({
        assignments: [],
        total: 0,
        page: 1,
        pageSize: 50,
      }),
    };
    const controller = new AdminRolesV1Controller(
      assignments as unknown as AdminRoleAssignmentsService,
    );
    const query = { page: 1, pageSize: 50, roleKey: 'support' };

    await expect(controller.listAssignments(query)).resolves.toEqual({
      assignments: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    expect(assignments.list).toHaveBeenCalledWith(query);
  });
});
