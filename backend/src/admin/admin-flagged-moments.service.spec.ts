import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountSuspensionService } from '../account-suspension/account-suspension.service';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuthorizationService } from './admin-authorization.service';
import { AdminFlaggedMomentsService } from './admin-flagged-moments.service';

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

function query(result: QueryResult) {
  const settled = { data: null, error: null, count: null, ...result };
  const builder: Record<string, unknown> = {};
  for (const method of [
    'select',
    'update',
    'eq',
    'not',
    'in',
    'order',
    'range',
  ]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(settled));
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(settled).then(resolve);
  return builder;
}

const ACTOR = '22222222-2222-4222-8222-222222222222';
const AUTHOR = '11111111-1111-4111-8111-111111111111';
const REPORT = '66666666-6666-4666-8666-666666666666';
const MOMENT = '77777777-7777-4777-8777-777777777777';
const KEY = '33333333-3333-4333-8333-333333333333';

const suspendInput = {
  expiresAt: '2026-11-16T10:00:00.000Z',
  reasonCode: 'policy_violation' as const,
  idempotencyKey: KEY,
};

describe('AdminFlaggedMomentsService', () => {
  let service: AdminFlaggedMomentsService;
  let queues: Record<string, Array<Record<string, unknown>>>;
  let from: ReturnType<typeof vi.fn>;
  let suspensions: {
    findActiveForUsers: ReturnType<typeof vi.fn>;
    issue: ReturnType<typeof vi.fn>;
  };
  let authorization: { getEffectiveCapabilities: ReturnType<typeof vi.fn> };
  let metrics: { recordAdminReportResolution: ReturnType<typeof vi.fn> };

  const enqueue = (table: string, result: QueryResult) => {
    const builder = query(result);
    (queues[table] ??= []).push(builder);
    return builder;
  };

  beforeEach(() => {
    queues = {};
    from = vi.fn((table: string) => {
      const next = queues[table]?.shift();
      if (!next) throw new Error(`unexpected query on ${table}`);
      return next;
    });
    suspensions = {
      findActiveForUsers: vi.fn().mockResolvedValue(new Map()),
      issue: vi.fn(),
    };
    authorization = {
      getEffectiveCapabilities: vi.fn().mockResolvedValue([]),
    };
    metrics = { recordAdminReportResolution: vi.fn() };
    service = new AdminFlaggedMomentsService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      suspensions as unknown as AccountSuspensionService,
      authorization as unknown as AdminAuthorizationService,
      metrics as unknown as MetricsService,
    );
  });

  describe('list', () => {
    const reportRow = {
      id: REPORT,
      reporter_id: ACTOR,
      reported_user_id: AUTHOR,
      reported_moment_id: MOMENT,
      reported_moment_excerpt: 'flagged words',
      reason_category: 'harassment',
      description: 'rude',
      status: 'pending',
      created_at: '2026-11-09T10:00:00.000Z',
      reported: { display_name: 'Author' },
      reporter: { display_name: 'Reporter' },
    };

    it('joins snapshot, live media and active suspension in three bounded queries', async () => {
      const reports = enqueue('reports', { data: [reportRow], count: 41 });
      enqueue('moments', {
        data: [
          {
            id: MOMENT,
            post_type: 'moment',
            target_language: 'es',
            media_type: 'image',
            media_urls: [
              'https://cdn.example.org/a.png',
              'http://insecure.example.org/b.png',
              'javascript:alert(1)',
              42,
            ],
          },
        ],
      });
      suspensions.findActiveForUsers.mockResolvedValue(
        new Map([
          [AUTHOR, { id: 'susp-1', expiresAt: '2026-11-20T00:00:00.000Z' }],
        ]),
      );

      const result = await service.list({
        page: 3,
        pageSize: 10,
        status: 'pending',
      });

      expect(reports.range).toHaveBeenCalledWith(20, 29);
      expect(reports.not).toHaveBeenCalledWith(
        'reported_moment_id',
        'is',
        null,
      );
      expect(reports.eq).toHaveBeenCalledWith('status', 'pending');
      expect(suspensions.findActiveForUsers).toHaveBeenCalledWith([AUTHOR]);
      expect(result).toEqual({
        total: 41,
        page: 3,
        pageSize: 10,
        items: [
          {
            reportId: REPORT,
            status: 'pending',
            reasonCategory: 'harassment',
            reportDescription: 'rude',
            createdAt: '2026-11-09T10:00:00.000Z',
            reporter: { id: ACTOR, displayName: 'Reporter' },
            author: {
              id: AUTHOR,
              displayName: 'Author',
              activeSuspension: {
                id: 'susp-1',
                expiresAt: '2026-11-20T00:00:00.000Z',
              },
            },
            moment: {
              id: MOMENT,
              excerpt: 'flagged words',
              available: true,
              postType: 'moment',
              targetLanguage: 'es',
              mediaType: 'image',
              mediaUrls: ['https://cdn.example.org/a.png'],
            },
          },
        ],
      });
    });

    it('keeps the evidence snapshot when the author deleted the Moment', async () => {
      enqueue('reports', { data: [reportRow], count: 1 });
      enqueue('moments', { data: [] });

      const { items } = await service.list({});

      expect(items[0].moment).toMatchObject({
        available: false,
        excerpt: 'flagged words',
        mediaUrls: [],
      });
    });

    it('still lists the queue when media evidence cannot be loaded', async () => {
      enqueue('reports', { data: [reportRow], count: 1 });
      enqueue('moments', { error: { message: 'down' } });

      const { items } = await service.list({});

      expect(items).toHaveLength(1);
      expect(items[0].moment.available).toBe(false);
    });

    it('defaults to the first pending page and skips the moment lookup when empty', async () => {
      const reports = enqueue('reports', { data: [], count: 0 });

      const result = await service.list({});

      expect(reports.range).toHaveBeenCalledWith(0, 19);
      expect(reports.eq).toHaveBeenCalledWith('status', 'pending');
      expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
      expect(from).toHaveBeenCalledTimes(1);
    });

    it('reports a storage failure as unavailable instead of an empty queue', async () => {
      enqueue('reports', { error: { message: 'down' } });

      await expect(service.list({})).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('drops malformed rows rather than rendering partial cases', async () => {
      enqueue('reports', {
        data: [
          { id: REPORT },
          null,
          'text',
          { ...reportRow, reported_moment_id: null },
        ],
        count: 4,
      });

      const { items } = await service.list({});

      expect(items).toEqual([]);
    });
  });

  describe('resolve', () => {
    const report = (status: string, momentId: string | null = MOMENT) => ({
      id: REPORT,
      status,
      reported_user_id: AUTHOR,
      reported_moment_id: momentId,
    });

    it.each([
      ['dismiss', 'approved', 'approve'],
      ['uphold', 'rejected', 'reject'],
    ] as const)(
      'maps %s to %s with a conditional update on pending',
      async (decision, status, metricAction) => {
        enqueue('reports', { data: report('pending') });
        const update = enqueue('reports', { data: { id: REPORT } });

        const result = await service.resolve(REPORT, decision);

        expect(result).toEqual({ reportId: REPORT, status, replayed: false });
        expect(update.update).toHaveBeenCalledWith({ status });
        expect(update.eq).toHaveBeenCalledWith('status', 'pending');
        expect(metrics.recordAdminReportResolution).toHaveBeenCalledWith(
          metricAction,
          'success',
        );
      },
    );

    it('treats repeating the same decision as a no-op', async () => {
      enqueue('reports', { data: report('approved') });

      const result = await service.resolve(REPORT, 'dismiss');

      expect(result.replayed).toBe(true);
      expect(from).toHaveBeenCalledTimes(1);
    });

    it('refuses to flip a decision another reviewer already made', async () => {
      enqueue('reports', { data: report('approved') });

      await expect(service.resolve(REPORT, 'uphold')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('resolves a lost race by re-reading the settled state', async () => {
      enqueue('reports', { data: report('pending') });
      enqueue('reports', { data: null });
      enqueue('reports', { data: report('rejected') });

      await expect(service.resolve(REPORT, 'uphold')).resolves.toMatchObject({
        replayed: true,
        status: 'rejected',
      });
    });

    it('conflicts when the race was lost to the opposite decision', async () => {
      enqueue('reports', { data: report('pending') });
      enqueue('reports', { data: null });
      enqueue('reports', { data: report('approved') });

      await expect(service.resolve(REPORT, 'uphold')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects reports that are not about a Moment', async () => {
      enqueue('reports', { data: report('pending', null) });

      await expect(service.resolve(REPORT, 'dismiss')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns not found for an unknown report', async () => {
      enqueue('reports', { data: null });

      await expect(service.resolve(REPORT, 'dismiss')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('records a failure metric when storage rejects the update', async () => {
      enqueue('reports', { data: report('pending') });
      enqueue('reports', { error: { message: 'down' } });

      await expect(service.resolve(REPORT, 'dismiss')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(metrics.recordAdminReportResolution).toHaveBeenCalledWith(
        'approve',
        'failure',
      );
    });
  });

  describe('suspendUser', () => {
    const outcome = {
      suspension: { id: 'susp-1' },
      replayed: false,
    };

    beforeEach(() => {
      suspensions.issue.mockResolvedValue(outcome);
    });

    it('suspends the author and upholds the justifying report', async () => {
      enqueue('reports', {
        data: {
          id: REPORT,
          status: 'pending',
          reported_user_id: AUTHOR,
          reported_moment_id: MOMENT,
        },
      });
      enqueue('reports', {
        data: {
          id: REPORT,
          status: 'pending',
          reported_user_id: AUTHOR,
          reported_moment_id: MOMENT,
        },
      });
      enqueue('reports', { data: { id: REPORT } });

      const result = await service.suspendUser(ACTOR, AUTHOR, {
        ...suspendInput,
        reportId: REPORT,
        operatorNote: 'context',
      });

      expect(suspensions.issue).toHaveBeenCalledWith({
        actorUserId: ACTOR,
        targetUserId: AUTHOR,
        reasonCode: 'policy_violation',
        operatorNote: 'context',
        expiresAt: new Date('2026-11-16T10:00:00.000Z'),
        idempotencyKey: KEY,
        reportId: REPORT,
      });
      expect(result).toEqual({ ...outcome, reportStatus: 'rejected' });
    });

    it('suspends without a report when none is cited', async () => {
      const result = await service.suspendUser(ACTOR, AUTHOR, suspendInput);

      expect(result.reportStatus).toBeNull();
      expect(from).not.toHaveBeenCalled();
    });

    it('refuses to suspend the operator themselves', async () => {
      await expect(
        service.suspendUser(ACTOR, ACTOR, suspendInput),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(suspensions.issue).not.toHaveBeenCalled();
    });

    it('refuses to suspend an administrator', async () => {
      authorization.getEffectiveCapabilities.mockResolvedValue(['users.read']);

      const error = await service
        .suspendUser(ACTOR, AUTHOR, suspendInput)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'ADMIN_TARGET_PROTECTED',
      });
      expect(suspensions.issue).not.toHaveBeenCalled();
    });

    it('refuses a report that concerns a different user', async () => {
      enqueue('reports', {
        data: {
          id: REPORT,
          status: 'pending',
          reported_user_id: 'someone-else',
          reported_moment_id: MOMENT,
        },
      });

      await expect(
        service.suspendUser(ACTOR, AUTHOR, {
          ...suspendInput,
          reportId: REPORT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(suspensions.issue).not.toHaveBeenCalled();
    });

    it('keeps the suspension when the report was already dismissed', async () => {
      const row = {
        id: REPORT,
        status: 'approved',
        reported_user_id: AUTHOR,
        reported_moment_id: MOMENT,
      };
      enqueue('reports', { data: row });
      enqueue('reports', { data: row });

      const result = await service.suspendUser(ACTOR, AUTHOR, {
        ...suspendInput,
        reportId: REPORT,
      });

      expect(result.suspension).toEqual(outcome.suspension);
      expect(result.reportStatus).toBeNull();
    });

    it('does not touch the report when the suspension fails', async () => {
      enqueue('reports', {
        data: {
          id: REPORT,
          status: 'pending',
          reported_user_id: AUTHOR,
          reported_moment_id: MOMENT,
        },
      });
      suspensions.issue.mockRejectedValue(new ServiceUnavailableException());

      await expect(
        service.suspendUser(ACTOR, AUTHOR, {
          ...suspendInput,
          reportId: REPORT,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(from).toHaveBeenCalledTimes(1);
    });
  });
});
