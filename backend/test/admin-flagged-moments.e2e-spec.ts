import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AccountSuspensionService } from '../src/account-suspension/account-suspension.service';
import { AdminAuditService } from '../src/admin/admin-audit.service';
import { AdminAuthorizationService } from '../src/admin/admin-authorization.service';
import { AdminFlaggedMomentsService } from '../src/admin/admin-flagged-moments.service';
import { AdminModerationV1Controller } from '../src/admin/admin-moderation-v1.controller';
import { AdminGuard } from '../src/admin/guards/admin.guard';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';

const USER = '11111111-1111-4111-8111-111111111111';
const REPORT = '66666666-6666-4666-8666-666666666666';
const SUSPENSION = '44444444-4444-4444-8444-444444444444';
const KEY = '33333333-3333-4333-8333-333333333333';

describe('Admin flagged-Moment moderation E2E', () => {
  let app: INestApplication;
  const hasAllCapabilities = vi.fn();
  const auditRecord = vi.fn();
  const list = vi.fn();
  const resolve = vi.fn();
  const suspendUser = vi.fn();
  const lift = vi.fn();

  beforeEach(async () => {
    for (const mock of [
      hasAllCapabilities,
      auditRecord,
      list,
      resolve,
      suspendUser,
      lift,
    ]) {
      mock.mockReset();
    }
    auditRecord.mockResolvedValue(undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminModerationV1Controller],
      providers: [
        {
          provide: AdminAuthorizationService,
          useValue: { hasAllCapabilities },
        },
        { provide: AdminAuditService, useValue: { record: auditRecord } },
        {
          provide: AdminFlaggedMomentsService,
          useValue: { list, resolve, suspendUser },
        },
        { provide: AccountSuspensionService, useValue: { lift } },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: vi.fn((context) => {
          context.switchToHttp().getRequest().user = { id: 'operator-1' };
          return true;
        }),
      })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
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

  it('refuses every route when the operator lacks the capability, touching nothing', async () => {
    hasAllCapabilities.mockResolvedValue(false);
    const http = request(app.getHttpServer());

    await http.get('/admin/v1/moderation/flagged-moments').expect(403);
    await http
      .post(`/admin/v1/moderation/flagged-moments/${REPORT}/resolve`)
      .send({ decision: 'dismiss', reasonCode: 'policy_violation' })
      .expect(403);
    await http
      .post(`/admin/v1/moderation/users/${USER}/suspensions`)
      .send({
        expiresAt: '2026-11-16T10:00:00.000Z',
        reasonCode: 'policy_violation',
        idempotencyKey: KEY,
      })
      .expect(403);
    await http
      .post(`/admin/v1/moderation/suspensions/${SUSPENSION}/lift`)
      .send({ reasonCode: 'support_correction' })
      .expect(403);

    expect(list).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(suspendUser).not.toHaveBeenCalled();
    expect(lift).not.toHaveBeenCalled();
  });

  it('checks the read capability for the queue and returns it uncached', async () => {
    hasAllCapabilities.mockResolvedValue(true);
    list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });

    const response = await request(app.getHttpServer())
      .get('/admin/v1/moderation/flagged-moments')
      .query({ page: '2', pageSize: '10', status: 'rejected' })
      .expect(200);

    expect(hasAllCapabilities).toHaveBeenCalledWith('operator-1', [
      'moderation.cases.read',
    ]);
    expect(list).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      status: 'rejected',
    });
    expect(response.headers['cache-control']).toContain('no-store');
  });

  it.each([
    ['page size above the bound', { pageSize: '51' }],
    ['an unknown status', { status: 'everything' }],
    ['an unknown filter', { reporterId: USER }],
  ])('rejects the queue query with %s', async (_label, query) => {
    hasAllCapabilities.mockResolvedValue(true);

    await request(app.getHttpServer())
      .get('/admin/v1/moderation/flagged-moments')
      .query(query)
      .expect(400);

    expect(list).not.toHaveBeenCalled();
  });

  it('requires the manage capability and validates a suspension request', async () => {
    hasAllCapabilities.mockResolvedValue(true);
    suspendUser.mockResolvedValue({ replayed: false });
    const http = request(app.getHttpServer());

    await http
      .post(`/admin/v1/moderation/users/${USER}/suspensions`)
      .send({
        expiresAt: '2026-11-16T10:00:00.000Z',
        reasonCode: 'policy_violation',
        idempotencyKey: KEY,
        operatorNote: 'context',
      })
      .expect(200);

    expect(hasAllCapabilities).toHaveBeenCalledWith('operator-1', [
      'moderation.cases.manage',
    ]);
    expect(suspendUser).toHaveBeenCalledWith(
      'operator-1',
      USER,
      expect.objectContaining({
        idempotencyKey: KEY,
        reasonCode: 'policy_violation',
      }),
    );

    suspendUser.mockClear();
    const invalid = [
      { reasonCode: 'policy_violation', expiresAt: '2026-11-16T10:00:00.000Z' },
      {
        idempotencyKey: 'not-a-uuid',
        reasonCode: 'policy_violation',
        expiresAt: '2026-11-16T10:00:00.000Z',
      },
      {
        idempotencyKey: KEY,
        reasonCode: 'because',
        expiresAt: '2026-11-16T10:00:00.000Z',
      },
      {
        idempotencyKey: KEY,
        reasonCode: 'policy_violation',
        expiresAt: 'tomorrow',
      },
      {
        idempotencyKey: KEY,
        reasonCode: 'policy_violation',
        expiresAt: '2026-11-16T10:00:00.000Z',
        issuedBy: 'forged-operator',
      },
    ];
    for (const body of invalid) {
      await http
        .post(`/admin/v1/moderation/users/${USER}/suspensions`)
        .send(body)
        .expect(400);
    }
    await http
      .post('/admin/v1/moderation/users/not-a-uuid/suspensions')
      .send({
        expiresAt: '2026-11-16T10:00:00.000Z',
        reasonCode: 'policy_violation',
        idempotencyKey: KEY,
      })
      .expect(400);
    expect(suspendUser).not.toHaveBeenCalled();
  });

  it('resolves a report and lifts a suspension with validated bodies', async () => {
    hasAllCapabilities.mockResolvedValue(true);
    resolve.mockResolvedValue({
      reportId: REPORT,
      status: 'approved',
      replayed: false,
    });
    lift.mockResolvedValue({ replayed: false });
    const http = request(app.getHttpServer());

    await http
      .post(`/admin/v1/moderation/flagged-moments/${REPORT}/resolve`)
      .send({ decision: 'dismiss', reasonCode: 'other_reviewed' })
      .expect(200);
    expect(resolve).toHaveBeenCalledWith(REPORT, 'dismiss');

    await http
      .post(`/admin/v1/moderation/flagged-moments/${REPORT}/resolve`)
      .send({ decision: 'ban-forever', reasonCode: 'other_reviewed' })
      .expect(400);

    await http
      .post(`/admin/v1/moderation/suspensions/${SUSPENSION}/lift`)
      .send({ reasonCode: 'support_correction' })
      .expect(200);
    expect(lift).toHaveBeenCalledWith({
      actorUserId: 'operator-1',
      suspensionId: SUSPENSION,
      reasonCode: 'support_correction',
      operatorNote: undefined,
    });
  });
});
