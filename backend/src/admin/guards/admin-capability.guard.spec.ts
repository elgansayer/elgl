import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminCapabilityGuard } from './admin-capability.guard';

function buildContext(user?: { id: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('AdminCapabilityGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let authorization: { hasAllCapabilities: ReturnType<typeof vi.fn> };
  let guard: AdminCapabilityGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    authorization = { hasAllCapabilities: vi.fn() };
    guard = new AdminCapabilityGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AdminAuthorizationService,
    );
  });

  it('rejects requests without an authenticated user', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows authenticated requests when no capability metadata exists', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
    expect(authorization.hasAllCapabilities).not.toHaveBeenCalled();
  });

  it('allows a request when all required capabilities are present', async () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read', 'audit.read']);
    authorization.hasAllCapabilities.mockResolvedValue(true);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
    expect(authorization.hasAllCapabilities).toHaveBeenCalledWith('admin-1', [
      'users.read',
      'audit.read',
    ]);
  });

  it('fails closed when a required capability is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['users.manage']);
    authorization.hasAllCapabilities.mockResolvedValue(false);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
