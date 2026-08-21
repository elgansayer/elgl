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

describe('AdminV1Controller', () => {
  const buildController = () => {
    const authorization = {
      getEffectiveCapabilities: vi
        .fn()
        .mockResolvedValue(['users.read', 'audit.read']),
    };
    const adminService = {
      listUsers: vi.fn(),
      getLoginHistory: vi.fn(),
    };
    const userDetailService = {
      getUser: vi.fn(),
    };
    const loginHistoryQuery = {
      list: vi.fn(),
    };
    const audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    const auditQuery = {
      list: vi.fn(),
    };
    const moderationQuery = {
      list: vi.fn(),
    };
    const systemHealth = {
      getSnapshot: vi.fn(),
    };
    const roleInventory = {
      list: vi.fn(),
    };
    const controller = new AdminV1Controller(
      authorization as unknown as AdminAuthorizationService,
      adminService as unknown as AdminService,
      userDetailService as unknown as AdminUserDetailService,
      loginHistoryQuery as unknown as AdminLoginHistoryQueryService,
      audit as unknown as AdminAuditService,
      auditQuery as unknown as AdminAuditQueryService,
      moderationQuery as unknown as AdminModerationQueryService,
      systemHealth as unknown as AdminSystemHealthService,
      roleInventory as unknown as AdminRoleInventoryService,
    );

    return {
      controller,
      authorization,
      adminService,
      userDetailService,
      loginHistoryQuery,
      audit,
      auditQuery,
      moderationQuery,
      systemHealth,
      roleInventory,
    };
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

  it('delegates role inventory to AdminRoleInventoryService', async () => {
    const { controller, roleInventory } = buildController();
    const expected = [
      {
        id: 'role-1',
        key: 'support',
        name: 'Support',
        description: 'Support operators',
        is_system: false,
        created_at: '2026-08-15T20:00:00.000Z',
        updated_at: '2026-08-15T20:00:00.000Z',
        capabilities: ['users.read'],
      },
    ];
    roleInventory.list.mockResolvedValue(expected);

    await expect(controller.listRoles()).resolves.toEqual(expected);
    expect(roleInventory.list).toHaveBeenCalledOnce();
  });

  it('delegates bounded system health to AdminSystemHealthService', async () => {
    const { controller, systemHealth } = buildController();
    const expected = {
      state: 'healthy',
      checkedAt: '2026-08-15T20:00:00.000Z',
      dependencies: { database: 'healthy', redis: 'healthy' },
    };
    systemHealth.getSnapshot.mockResolvedValue(expected);
    const request = {
      user: { id: 'admin-1' },
      headers: {},
    } as never;

    await expect(controller.getSystemHealth(request)).resolves.toEqual(
      expected,
    );
    expect(systemHealth.getSnapshot).toHaveBeenCalledOnce();
  });

  it('audits successful bounded audit-log reads', async () => {
    const { controller, auditQuery, audit } = buildController();
    const query = { page: 2, pageSize: 25, action: 'users.login_history.read' };
    const expected = { events: [], total: 0, page: 2, pageSize: 25 };
    auditQuery.list.mockResolvedValue(expected);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-audit-1' },
    } as never;

    await expect(controller.listAudit(query, request)).resolves.toEqual(
      expected,
    );
    expect(auditQuery.list).toHaveBeenCalledWith(query);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'audit.events.read',
      capabilityKey: 'audit.read',
      targetType: 'admin-audit-log',
      outcome: 'success',
      correlationId: 'request-audit-1',
      metadata: { resultCount: 0, total: 0, source: 'admin-v1' },
    });
  });

  it('audits failed audit-log reads without recording private error details', async () => {
    const { controller, auditQuery, audit } = buildController();
    const storageError = new Error('private audit storage detail');
    auditQuery.list.mockRejectedValue(storageError);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-audit-2' },
    } as never;

    await expect(controller.listAudit({}, request)).rejects.toBe(storageError);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'audit.events.read',
      capabilityKey: 'audit.read',
      targetType: 'admin-audit-log',
      outcome: 'failed',
      correlationId: 'request-audit-2',
      metadata: { source: 'admin-v1' },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'private audit storage detail',
    );
  });

  it('fails closed when audit-log read auditing fails', async () => {
    const { controller, auditQuery, audit } = buildController();
    auditQuery.list.mockResolvedValue({
      events: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
    audit.record.mockRejectedValue(new Error('audit unavailable'));
    const request = {
      user: { id: 'admin-1' },
      headers: {},
    } as never;

    await expect(controller.listAudit({}, request)).rejects.toThrow(
      'audit unavailable',
    );
  });

  it('delegates and audits bounded moderation reports', async () => {
    const { controller, moderationQuery, audit } = buildController();
    const query = {
      page: 2,
      pageSize: 25,
      status: 'open',
      reasonCategory: 'harassment',
    };
    const expected = { reports: [], total: 0, page: 2, pageSize: 25 };
    moderationQuery.list.mockResolvedValue(expected);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-moderation-1' },
    } as never;

    await expect(
      controller.listModerationReports(query, request),
    ).resolves.toEqual(expected);
    expect(moderationQuery.list).toHaveBeenCalledWith(query);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'moderation.reports.read',
      capabilityKey: 'moderation.cases.read',
      targetType: 'moderation-report-queue',
      outcome: 'success',
      correlationId: 'request-moderation-1',
      metadata: { resultCount: 0, total: 0, source: 'admin-v1' },
    });
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

  it('audits privacy-scrubbed login-history reads before returning them', async () => {
    const { controller, loginHistoryQuery, audit } = buildController();
    const expected = [
      {
        id: 'history-1',
        user_id: 'user-1',
        ip_address: '203.0.113.0',
        user_agent: 'Browser',
        created_at: '2026-08-15T20:00:00.000Z',
      },
    ];
    loginHistoryQuery.list.mockResolvedValue(expected);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-1' },
    } as never;

    await expect(
      controller.getUserLoginHistory('user-1', request),
    ).resolves.toEqual(expected);
    expect(loginHistoryQuery.list).toHaveBeenCalledWith('user-1');
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'users.login_history.read',
      capabilityKey: 'users.sessions.read',
      targetType: 'user',
      targetId: 'user-1',
      outcome: 'success',
      correlationId: 'request-1',
      metadata: { resultCount: 1, source: 'admin-v1' },
    });
  });

  it('audits failed login-history reads without recording private error details', async () => {
    const { controller, loginHistoryQuery, audit } = buildController();
    const storageError = new Error('private database detail');
    loginHistoryQuery.list.mockRejectedValue(storageError);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-2' },
    } as never;

    await expect(
      controller.getUserLoginHistory('user-1', request),
    ).rejects.toBe(storageError);
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'users.login_history.read',
      capabilityKey: 'users.sessions.read',
      targetType: 'user',
      targetId: 'user-1',
      outcome: 'failed',
      correlationId: 'request-2',
      metadata: { source: 'admin-v1' },
    });
    expect(JSON.stringify(audit.record.mock.calls)).not.toContain(
      'private database detail',
    );
  });

  it('fails closed when login-history auditing fails', async () => {
    const { controller, loginHistoryQuery, audit } = buildController();
    loginHistoryQuery.list.mockResolvedValue([]);
    audit.record.mockRejectedValue(new Error('audit unavailable'));
    const request = {
      user: { id: 'admin-1' },
      headers: {},
    } as never;

    await expect(
      controller.getUserLoginHistory('user-1', request),
    ).rejects.toThrow('audit unavailable');
  });

  it('delegates bounded user inspection to AdminUserDetailService', async () => {
    const { controller, userDetailService } = buildController();
    const expected = { id: 'user-1', display_name: 'Mika' };
    userDetailService.getUser.mockResolvedValue(expected);

    await expect(controller.getUser('user-1')).resolves.toEqual(expected);
    expect(userDetailService.getUser).toHaveBeenCalledWith('user-1');
  });
});
