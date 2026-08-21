import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authorization: { getEffectiveCapabilities: ReturnType<typeof vi.fn> };

  const buildContext = (user?: { id: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    authorization = { getEffectiveCapabilities: vi.fn() };
    guard = new AdminGuard(
      authorization as unknown as AdminAuthorizationService,
    );
  });

  it('throws UnauthorizedException when no user is on the request', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws ForbiddenException when the user has no active admin capabilities', async () => {
    authorization.getEffectiveCapabilities.mockResolvedValue([]);

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('fails closed when capability resolution errors', async () => {
    authorization.getEffectiveCapabilities.mockRejectedValue(
      new Error('RBAC lookup failed'),
    );

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow('RBAC lookup failed');
  });

  it('allows the request when the user has an active admin capability', async () => {
    authorization.getEffectiveCapabilities.mockResolvedValue(['users.read']);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
  });
});
