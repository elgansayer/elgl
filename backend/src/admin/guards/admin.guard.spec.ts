import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminAuditService } from '../admin-audit.service';
import { AdminAuthorizationService } from '../admin-authorization.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authorization: { getEffectiveCapabilities: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };

  const buildContext = (user?: { id: string }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          method: 'GET',
          baseUrl: '/api/admin/v1',
          path: '/users',
          route: { path: '/users' },
          headers: { 'x-request-id': 'request-123' },
        }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    authorization = { getEffectiveCapabilities: vi.fn() };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    guard = new AdminGuard(
      authorization as unknown as AdminAuthorizationService,
      audit as unknown as AdminAuditService,
    );
  });

  it('throws UnauthorizedException when no user is on the request', async () => {
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and audits when the user has no active admin capabilities', async () => {
    authorization.getEffectiveCapabilities.mockResolvedValue([]);

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user-1',
        outcome: 'denied',
        correlationId: 'request-123',
        metadata: expect.objectContaining({ source: 'admin-guard' }),
      }),
    );
  });

  it('fails closed and audits when capability resolution errors', async () => {
    const failure = new Error('RBAC lookup failed');
    authorization.getEffectiveCapabilities.mockRejectedValue(failure);

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toBe(failure);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failed' }),
    );
  });

  it('still fails closed when denied-audit persistence is unavailable', async () => {
    authorization.getEffectiveCapabilities.mockResolvedValue([]);
    audit.record.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      guard.canActivate(buildContext({ id: 'user-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows the request when the user has an active admin capability', async () => {
    authorization.getEffectiveCapabilities.mockResolvedValue(['users.read']);

    await expect(
      guard.canActivate(buildContext({ id: 'admin-1' })),
    ).resolves.toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
