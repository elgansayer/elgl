import { AdminAuditQueryService } from './admin-audit-query.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminLoginHistoryQueryService } from './admin-login-history-query.service';
import { AdminModerationQueryService } from './admin-moderation-query.service';
import { AdminRoleInventoryService } from './admin-role-inventory.service';
import { AdminService } from './admin.service';
import { AdminSystemHealthService } from './admin-system-health.service';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminV1Controller } from './admin-v1.controller';

describe('AdminV1Controller system health auditing', () => {
  const buildController = () => {
    const audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    const systemHealth = {
      getSnapshot: vi.fn(),
    };
    const controller = new AdminV1Controller(
      {} as AdminAuthorizationService,
      {} as AdminService,
      {} as AdminUserDetailService,
      {} as AdminLoginHistoryQueryService,
      audit as unknown as AdminAuditService,
      {} as AdminAuditQueryService,
      {} as AdminModerationQueryService,
      systemHealth as unknown as AdminSystemHealthService,
      {} as AdminRoleInventoryService,
    );

    return { controller, audit, systemHealth };
  };

  it('audits successful bounded system-health reads', async () => {
    const { controller, audit, systemHealth } = buildController();
    const snapshot = {
      state: 'healthy' as const,
      checkedAt: '2026-08-16T07:20:00.000Z',
      dependencies: { database: 'healthy' as const, redis: 'healthy' as const },
    };
    systemHealth.getSnapshot.mockResolvedValue(snapshot);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'health-request-1' },
    } as never;

    await expect(controller.getSystemHealth(request)).resolves.toEqual(
      snapshot,
    );
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'system.health.read',
      capabilityKey: 'system.health.read',
      targetType: 'system-health',
      outcome: 'success',
      correlationId: 'health-request-1',
      metadata: { source: 'admin-v1' },
    });
  });

  it('audits failed reads without persisting dependency error details', async () => {
    const { controller, audit, systemHealth } = buildController();
    const dependencyError = new Error(
      'redis host private.internal:6379 unavailable',
    );
    systemHealth.getSnapshot.mockRejectedValue(dependencyError);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'health-request-2' },
    } as never;

    await expect(controller.getSystemHealth(request)).rejects.toBe(
      dependencyError,
    );
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'system.health.read',
      capabilityKey: 'system.health.read',
      targetType: 'system-health',
      outcome: 'failed',
      correlationId: 'health-request-2',
      metadata: { source: 'admin-v1' },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'private.internal',
    );
  });

  it('fails closed when the health-read audit event cannot be persisted', async () => {
    const { controller, audit, systemHealth } = buildController();
    systemHealth.getSnapshot.mockResolvedValue({
      state: 'healthy',
      checkedAt: '2026-08-16T07:20:00.000Z',
      dependencies: { database: 'healthy', redis: 'healthy' },
    });
    audit.record.mockRejectedValue(new Error('audit unavailable'));
    const request = {
      user: { id: 'admin-1' },
      headers: {},
    } as never;

    await expect(controller.getSystemHealth(request)).rejects.toThrow(
      'audit unavailable',
    );
  });
});
