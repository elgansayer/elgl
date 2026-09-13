import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminCapabilityGuard } from './admin-capability.guard';

function buildContext(user?: { id: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user,
        method: 'GET',
        baseUrl: '/api/admin/v1',
        path: '/users/:id',
        route: { path: '/users/:id' },
        params: { id: 'target-user' },
        headers: { 'x-request-id': 'request-123' },
      }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('AdminCapabilityGuard', () => {
  let reflector: { getAllAndOverride: ReturnType<typeof vi.fn> };
  let authorization: { hasAllCapabilities: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let guard: AdminCapabilityGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: vi.fn() };
    authorization = { hasAllCapabilities: vi.fn() };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    guard = new AdminCapabilityGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AdminAuthorizationService,
      audit as unknown as AdminAuditService,
    );
  });

  it('rejects requests without an authenticated user', async () => {
    await expect(guard.canActivate(buildContext())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('allows authenticated requests when no capability metadata exists', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
    expect(authorization.hasAllCapabilities).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
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
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('fails closed and audits when a required capability is missing', async () => {
    reflector.getAllAndOverride.mockReturnValue(['users.manage']);
    authorization.hasAllCapabilities.mockResolvedValue(false);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).rejects.toThrow(ForbiddenException);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        capabilityKey: 'users.manage',
        targetId: 'target-user',
        outcome: 'denied',
        correlationId: 'request-123',
        metadata: expect.objectContaining({ source: 'admin-capability-guard' }),
      }),
    );
  });

  it('audits failed capability resolution without changing the original error', async () => {
    reflector.getAllAndOverride.mockReturnValue(['users.read']);
    const failure = new Error('RBAC lookup failed');
    authorization.hasAllCapabilities.mockRejectedValue(failure);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).rejects.toBe(failure);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityKey: 'users.read',
        outcome: 'failed',
      }),
    );
  });

  it('still denies access when denied-audit persistence is unavailable', async () => {
    reflector.getAllAndOverride.mockReturnValue(['users.manage']);
    authorization.hasAllCapabilities.mockResolvedValue(false);
    audit.record.mockRejectedValue(new Error('audit store unavailable'));

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).rejects.toThrow(ForbiddenException);
  });
});
