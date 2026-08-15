import { ADMIN_BOOTSTRAP_CAPABILITIES } from './admin-capabilities';
import { AdminV1Controller } from './admin-v1.controller';

describe('AdminV1Controller', () => {
  it('returns the authenticated admin identity and bootstrap capabilities', () => {
    const controller = new AdminV1Controller();
    const request = {
      user: {
        id: 'admin-user-id',
        email: 'admin@example.com',
      },
    } as never;

    expect(controller.getMe(request)).toEqual({
      user: {
        id: 'admin-user-id',
        email: 'admin@example.com',
      },
      capabilities: ADMIN_BOOTSTRAP_CAPABILITIES,
      authorizationModel: 'legacy-is-admin-bootstrap',
    });
  });
});
