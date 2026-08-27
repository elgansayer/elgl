import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { AdminAuditQueryService } from '../src/admin/admin-audit-query.service';
import { AdminAuditService } from '../src/admin/admin-audit.service';
import { AdminAuthorizationService } from '../src/admin/admin-authorization.service';
import { AdminLoginHistoryQueryService } from '../src/admin/admin-login-history-query.service';
import { AdminModerationQueryService } from '../src/admin/admin-moderation-query.service';
import { AdminRoleInventoryService } from '../src/admin/admin-role-inventory.service';
import { AdminService } from '../src/admin/admin.service';
import { AdminSystemHealthService } from '../src/admin/admin-system-health.service';
import { AdminUserDetailService } from '../src/admin/admin-user-detail.service';
import { AdminGuard } from '../src/admin/guards/admin.guard';
import { AdminV1Controller } from '../src/admin/admin-v1.controller';

describe('Admin moderation queue E2E', () => {
  let app: INestApplication;
  const hasAllCapabilities = vi.fn();
  const moderationList = vi.fn();
  const auditRecord = vi.fn();

  beforeEach(async () => {
    hasAllCapabilities.mockReset();
    moderationList.mockReset();
    auditRecord.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminV1Controller],
      providers: [
        {
          provide: AdminAuthorizationService,
          useValue: {
            hasAllCapabilities,
            getEffectiveCapabilities: vi
              .fn()
              .mockResolvedValue(['moderation.cases.read']),
          },
        },
        { provide: AdminService, useValue: {} },
        { provide: AdminUserDetailService, useValue: {} },
        { provide: AdminLoginHistoryQueryService, useValue: {} },
        { provide: AdminAuditService, useValue: { record: auditRecord } },
        { provide: AdminAuditQueryService, useValue: {} },
        {
          provide: AdminModerationQueryService,
          useValue: { list: moderationList },
        },
        { provide: AdminSystemHealthService, useValue: {} },
        { provide: AdminRoleInventoryService, useValue: {} },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          context.switchToHttp().getRequest().user = { id: 'admin-1' };
          return true;
        }),
      })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('requires moderation.cases.read before returning the queue', async () => {
    hasAllCapabilities.mockResolvedValue(false);

    await request(app.getHttpServer())
      .get('/admin/v1/moderation/reports')
      .expect(403);

    expect(hasAllCapabilities).toHaveBeenCalledWith('admin-1', [
      'moderation.cases.read',
    ]);
    expect(moderationList).not.toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'get /admin/v1/moderation/reports',
      capabilityKey: 'moderation.cases.read',
      targetType: undefined,
      targetId: undefined,
      outcome: 'denied',
      correlationId: undefined,
      metadata: {
        source: 'admin-capability-guard',
        operation: 'capability-denied',
      },
    });
  });

  it('transforms bounded query filters and audits the moderation queue read', async () => {
    hasAllCapabilities.mockResolvedValue(true);
    moderationList.mockResolvedValue({
      reports: [
        {
          id: 'report-1',
          reporter_id: 'reporter-1',
          reported_user_id: 'reported-1',
          reason: 'harassment',
          status: 'open',
          description: 'Repeated harassment',
          created_at: '2026-08-16T00:00:00.000Z',
          updated_at: '2026-08-16T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 2,
      pageSize: 25,
    });

    const response = await request(app.getHttpServer())
      .get('/admin/v1/moderation/reports')
      .set('x-request-id', 'corr-1')
      .query({
        page: '2',
        pageSize: '25',
        status: 'open',
        reasonCategory: 'harassment',
        reportedUserId: 'reported-1',
      })
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.reports[0].id).toBe('report-1');
    expect(moderationList).toHaveBeenCalledWith({
      page: 2,
      pageSize: 25,
      reportId: undefined,
      status: 'open',
      reasonCategory: 'harassment',
      reportedUserId: 'reported-1',
      reporterUserId: undefined,
      startTime: undefined,
      endTime: undefined,
    });
    expect(auditRecord).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'moderation.reports.read',
      capabilityKey: 'moderation.cases.read',
      targetType: 'moderation-report-queue',
      outcome: 'success',
      correlationId: 'corr-1',
      metadata: {
        resultCount: 1,
        total: 1,
        source: 'admin-v1',
      },
    });
  });

  it('audits a failed moderation queue read without persisting query details', async () => {
    hasAllCapabilities.mockResolvedValue(true);
    moderationList.mockRejectedValue(new Error('sensitive storage detail'));

    await request(app.getHttpServer())
      .get('/admin/v1/moderation/reports')
      .set('x-request-id', 'corr-fail')
      .query({ reportedUserId: 'reported-1' })
      .expect(500);

    expect(auditRecord).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'moderation.reports.read',
      capabilityKey: 'moderation.cases.read',
      targetType: 'moderation-report-queue',
      outcome: 'failed',
      correlationId: 'corr-fail',
      metadata: { source: 'admin-v1' },
    });
  });

  it('rejects an oversized moderation page before querying storage', async () => {
    hasAllCapabilities.mockResolvedValue(true);

    await request(app.getHttpServer())
      .get('/admin/v1/moderation/reports?pageSize=101')
      .expect(400);

    expect(moderationList).not.toHaveBeenCalled();
    expect(auditRecord).not.toHaveBeenCalled();
  });
});
