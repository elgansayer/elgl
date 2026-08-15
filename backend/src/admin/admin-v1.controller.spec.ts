import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminService } from './admin.service';
import { AdminUserDetailService } from './admin-user-detail.service';
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
    const userDetailService = {
      getUser: vi.fn(),
    };
    const controller = new AdminV1Controller(
      authorization as unknown as AdminAuthorizationService,
      adminService as unknown as AdminService,
      userDetailService as unknown as AdminUserDetailService,
    );

    return { controller, authorization, adminService, userDetailService };
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

  it('delegates bounded user inspection to AdminUserDetailService', async () => {
    const { controller, userDetailService } = buildController();
    const expected = { id: 'user-1', display_name: 'Mika' };
    userDetailService.getUser.mockResolvedValue(expected);

    await expect(controller.getUser('user-1')).resolves.toEqual(expected);
    expect(userDetailService.getUser).toHaveBeenCalledWith('user-1');
  });
});
