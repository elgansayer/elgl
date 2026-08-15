import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminService } from './admin.service';
import { AdminV1Controller } from './admin-v1.controller';

describe('AdminV1Controller', () => {
  const buildController = () => {
    const authorization = {
      getEffectiveCapabilities: vi
        .fn()
        .mockResolvedValue(['users.read', 'audit.read']),
    };
    const adminService = {
      listUsers: vi.fn(),
    };
    const controller = new AdminV1Controller(
      authorization as unknown as AdminAuthorizationService,
      adminService as unknown as AdminService,
    );

    return { controller, authorization, adminService };
  };

  it('returns the authenticated admin identity and persisted effective capabilities', async () => {
    const { controller, authorization } = buildController();
    const request = {
      user: {
        id: 'admin-user-id',
        email: 'admin@example.com',
      },
    } as never;

    await expect(controller.getMe(request)).resolves.toEqual({
      user: {
        id: 'admin-user-id',
        email: 'admin@example.com',
      },
      capabilities: ['users.read', 'audit.read'],
      authorizationModel: 'rbac-v1',
    });
    expect(authorization.getEffectiveCapabilities).toHaveBeenCalledWith(
      'admin-user-id',
    );
  });

  it('delegates bounded user search to AdminService', async () => {
    const { controller, adminService } = buildController();
    const query = { page: 2, pageSize: 10, search: 'mika' };
    const expected = {
      users: [],
      total: 0,
      page: 2,
      pageSize: 10,
    };
    adminService.listUsers.mockResolvedValue(expected);

    await expect(controller.listUsers(query)).resolves.toEqual(expected);
    expect(adminService.listUsers).toHaveBeenCalledWith(query);
  });
});
