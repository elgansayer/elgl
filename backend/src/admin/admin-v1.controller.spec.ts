import { AdminAuditQueryService } from './admin-audit-query.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthorizationService } from './admin-authorization.service';
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
      listReports: vi.fn(),
      getLoginHistory: vi.fn(),
    };
    const userDetailService = {
      getUser: vi.fn(),
    };
    const audit = {
      record: vi.fn().mockResolvedValue(undefined),
    };
    const auditQuery = {
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
      audit as unknown as AdminAuditService,
      auditQuery as unknown as AdminAuditQueryService,
      systemHealth as unknown as AdminSystemHealthService,
      roleInventory as unknown as AdminRoleInventoryService,
    );

    return {
      controller,
      authorization,
      adminService,
      userDetailService,
      audit,
      auditQuery,
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

    await expect(controller.getSystemHealth()).resolves.toEqual(expected);
    expect(systemHealth.getSnapshot).toHaveBeenCalledOnce();
  });

  it('delegates bounded audit queries to AdminAuditQueryService', async () => {
    const { controller, auditQuery } = buildController();
    const query = { page: 2, pageSize: 25, action: 'users.login_history.read' };
    const expected = { events: [], total: 0, page: 2, pageSize: 25 };
    auditQuery.list.mockResolvedValue(expected);

    await expect(controller.listAudit(query)).resolves.toEqual(expected);
    expect(auditQuery.list).toHaveBeenCalledWith(query);
  });

  it('delegates bounded moderation reports to AdminService', async () => {
    const { controller, adminService } = buildController();
    const query = { page: 2, pageSize: 25, status: 'open' };
    const expected = { reports: [], total: 0, page: 2, pageSize: 25 };
    adminService.listReports.mockResolvedValue(expected);

    await expect(controller.listModerationReports(query)).resolves.toEqual(
      expected,
    );
    expect(adminService.listReports).toHaveBeenCalledWith(2, 25, 'open');
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
    const { controller, adminService, audit } = buildController();
    const expected = [
      {
        id: 'history-1',
        user_id: 'user-1',
        ip_address: '203.0.113.0',
        user_agent: 'Browser',
        created_at: '2026-08-15T20:00:00.000Z',
      },
    ];
    adminService.getLoginHistory.mockResolvedValue(expected);
    const request = {
      user: { id: 'admin-1' },
      headers: { 'x-request-id': 'request-1' },
    } as never;

    await expect(
      controller.getUserLoginHistory('user-1', request),
    ).resolves.toEqual(expected);
    expect(adminService.getLoginHistory).toHaveBeenCalledWith('user-1');
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

  it('fails closed when login-history auditing fails', async () => {
    const { controller, adminService, audit } = buildController();
    adminService.getLoginHistory.mockResolvedValue([]);
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
