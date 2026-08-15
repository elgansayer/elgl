import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminV1Controller } from './admin-v1.controller';

describe('AdminV1Controller', () => {
  it('returns the authenticated admin identity and persisted effective capabilities', async () => {
    const authorization = {
      getEffectiveCapabilities: vi
        .fn()
        .mockResolvedValue(['users.read', 'audit.read']),
    };
    const controller = new AdminV1Controller(
      authorization as unknown as AdminAuthorizationService,
    );
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
});
