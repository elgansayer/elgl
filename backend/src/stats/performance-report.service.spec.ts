import type { MockInstance } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AchievementsService } from '../achievements/achievements.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PerformanceReportService } from './performance-report.service';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const WEEK_START = '2026-11-03T12:00:00.000Z';
const WEEK_PREVIOUS_START = '2026-10-27T12:00:00.000Z';
const MONTH_START = '2026-10-11T12:00:00.000Z';
const MONTH_PREVIOUS_START = '2026-09-11T12:00:00.000Z';

interface RecordedQuery {
  table: string;
  calls: Array<[string, unknown[]]>;
}

type Resolver = (query: RecordedQuery) => unknown;

function lowerBound(query: RecordedQuery): unknown {
  return query.calls.find(([method]) => method === 'gte')?.[1][1];
}

function recorded(query: RecordedQuery, method: string): unknown[][] {
  return query.calls
    .filter(([name]) => name === method)
    .map(([, args]) => args);
}

function makeClient(resolvers: Record<string, Resolver>) {
  const queries: RecordedQuery[] = [];
  const from = vi.fn((table: string) => {
    const query: RecordedQuery = { table, calls: [] };
    queries.push(query);
    const chain: Record<string, unknown> = {};
    for (const method of [
      'select',
      'eq',
      'gte',
      'lt',
      'not',
      'or',
      'limit',
      'returns',
      'maybeSingle',
    ]) {
      chain[method] = vi.fn((...args: unknown[]) => {
        query.calls.push([method, args]);
        return chain;
      });
    }
    chain['then'] = (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) =>
      Promise.resolve()
        .then(() => resolvers[table](query))
        .then(resolve, reject);
    return chain;
  });
  return { client: { from }, queries };
}

function callLog(startedAt: string, durationSeconds: number | null) {
  return { started_at: startedAt, duration_seconds: durationSeconds };
}

function healthyResolvers(overrides: Record<string, Resolver> = {}) {
  const countByWindow =
    (current: number, previous: number): Resolver =>
    (query) => ({
      count: lowerBound(query) === WEEK_START ? current : previous,
      error: null,
    });
  return {
    chat_messages: countByWindow(12, 5),
    moment_comments: countByWindow(4, 6),
    moments: countByWindow(2, 2),
    lesson_progress: countByWindow(3, 1),
    call_logs: () => ({
      data: [
        callLog('2026-11-09T10:00:00.000Z', 3600),
        callLog('2026-11-04T10:00:00.000Z', 1800),
        callLog('2026-10-30T10:00:00.000Z', 7200),
      ],
      error: null,
    }),
    users: () => ({ data: { study_streak_days: 9 }, error: null }),
    ...overrides,
  };
}

describe('PerformanceReportService', () => {
  let service: PerformanceReportService;
  let achievements: { getUnlockedBetween: ReturnType<typeof vi.fn> };
  let errorSpy: MockInstance;

  async function build(resolvers: Record<string, Resolver>) {
    const made = makeClient(resolvers);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceReportService,
        {
          provide: SupabaseService,
          useValue: { getClient: vi.fn().mockReturnValue(made.client) },
        },
        { provide: AchievementsService, useValue: achievements },
      ],
    }).compile();
    service = module.get(PerformanceReportService);
    return made;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    achievements = {
      getUnlockedBetween: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('windows', () => {
    it('compares the latest rolling 7 days with the 7 days before them', async () => {
      await build(healthyResolvers());

      const report = await service.getReport('user-1', 'week');

      expect(report.period).toBe('week');
      expect(report.window).toEqual({
        start: WEEK_START,
        end: NOW.toISOString(),
      });
      expect(report.previous_window).toEqual({
        start: WEEK_PREVIOUS_START,
        end: WEEK_START,
      });
    });

    it('uses 30 day windows for the month period', async () => {
      await build(healthyResolvers());

      const report = await service.getReport('user-1', 'month');

      expect(report.window).toEqual({
        start: MONTH_START,
        end: NOW.toISOString(),
      });
      expect(report.previous_window).toEqual({
        start: MONTH_PREVIOUS_START,
        end: MONTH_START,
      });
    });

    it('defaults to the week period', async () => {
      await build(healthyResolvers());

      await expect(service.getReport('user-1')).resolves.toMatchObject({
        period: 'week',
        window: { start: WEEK_START },
      });
    });
  });

  describe('metrics', () => {
    it('reports current and previous totals in a fixed order', async () => {
      await build(healthyResolvers());

      const report = await service.getReport('user-1', 'week');

      expect(report.metrics).toEqual([
        { key: 'study_hours', current: 1.5, previous: 2 },
        { key: 'messages_sent', current: 12, previous: 5 },
        { key: 'corrections_made', current: 4, previous: 6 },
        { key: 'moments_posted', current: 2, previous: 2 },
        { key: 'lessons_completed', current: 3, previous: 1 },
      ]);
      expect(report.streak_days).toBe(9);
    });

    it('scopes every source to the caller and to each window', async () => {
      const { queries } = await build(healthyResolvers());

      await service.getReport('user-1', 'week');

      const forTable = (table: string) =>
        queries.filter((query) => query.table === table);

      for (const [table, ownerColumn, timeColumn] of [
        ['chat_messages', 'sender_id', 'created_at'],
        ['moment_comments', 'user_id', 'created_at'],
        ['moments', 'user_id', 'created_at'],
        ['lesson_progress', 'user_id', 'completed_at'],
      ] as const) {
        const tableQueries = forTable(table);
        expect(tableQueries).toHaveLength(2);
        for (const query of tableQueries) {
          expect(recorded(query, 'eq')).toContainEqual([ownerColumn, 'user-1']);
          expect(recorded(query, 'select')[0][1]).toEqual({
            count: 'exact',
            head: true,
          });
          expect(recorded(query, 'gte')[0][0]).toBe(timeColumn);
          expect(recorded(query, 'lt')[0][0]).toBe(timeColumn);
        }
        expect(
          tableQueries.map((query) => recorded(query, 'gte')[0][1]).sort(),
        ).toEqual([WEEK_PREVIOUS_START, WEEK_START].sort());
      }

      expect(recorded(forTable('moment_comments')[0], 'not')).toEqual([
        ['correction_payload', 'is', null],
      ]);
      expect(recorded(forTable('lesson_progress')[0], 'eq')).toContainEqual([
        'completed',
        true,
      ]);
    });

    it('reads study time from one bounded call log query for the caller', async () => {
      const { queries } = await build(healthyResolvers());

      await service.getReport('user-1', 'week');

      const [callQuery, ...rest] = queries.filter(
        (query) => query.table === 'call_logs',
      );
      expect(rest).toHaveLength(0);
      expect(recorded(callQuery, 'or')).toEqual([
        ['caller_id.eq.user-1,receiver_id.eq.user-1'],
      ]);
      expect(recorded(callQuery, 'gte')).toEqual([
        ['started_at', WEEK_PREVIOUS_START],
      ]);
      expect(recorded(callQuery, 'lt')).toEqual([
        ['started_at', NOW.toISOString()],
      ]);
      expect(recorded(callQuery, 'limit')).toEqual([[10_000]]);
    });

    it('ignores corrupt call logs and caps a single call at 24 hours', async () => {
      await build(
        healthyResolvers({
          call_logs: () => ({
            data: [
              callLog('not-a-date', 3600),
              callLog('2026-11-09T10:00:00.000Z', -50),
              callLog('2026-11-09T10:00:00.000Z', null),
              callLog('2026-11-09T10:00:00.000Z', Number.NaN),
              callLog('2026-11-09T10:00:00.000Z', 100 * 3600),
              callLog('2026-10-01T10:00:00.000Z', 3600),
            ],
            error: null,
          }),
        }),
      );

      const report = await service.getReport('user-1', 'week');

      expect(report.metrics[0]).toEqual({
        key: 'study_hours',
        current: 24,
        previous: 0,
      });
    });

    it('treats a missing user row as a zero streak', async () => {
      await build(
        healthyResolvers({ users: () => ({ data: null, error: null }) }),
      );

      await expect(service.getReport('user-1')).resolves.toMatchObject({
        streak_days: 0,
      });
    });

    it('returns zeroes for a learner with no activity', async () => {
      await build(
        healthyResolvers({
          chat_messages: () => ({ count: 0, error: null }),
          moment_comments: () => ({ count: null, error: null }),
          moments: () => ({ count: 0, error: null }),
          lesson_progress: () => ({ count: 0, error: null }),
          call_logs: () => ({ data: [], error: null }),
        }),
      );

      const report = await service.getReport('user-1');

      expect(
        report.metrics.every(
          (metric) => metric.current === 0 && metric.previous === 0,
        ),
      ).toBe(true);
      expect(report.badges_unlocked).toEqual([]);
    });
  });

  describe('badges', () => {
    it('returns only badges unlocked in the latest window', async () => {
      const badges = [
        {
          code: 'first_moment',
          name: 'First Moment',
          description: 'Share your first Moment.',
          unlocked_at: '2026-11-09T09:00:00.000Z',
        },
      ];
      achievements.getUnlockedBetween.mockResolvedValue(badges);
      await build(healthyResolvers());

      const report = await service.getReport('user-1', 'week');

      expect(achievements.getUnlockedBetween).toHaveBeenCalledWith(
        'user-1',
        new Date(WEEK_START),
        NOW,
      );
      expect(report.badges_unlocked).toEqual(badges);
    });
  });

  describe('failure handling', () => {
    it.each([
      ['chat_messages', 'chat_messages'],
      ['moment_comments', 'moment_comments'],
      ['moments', 'moments'],
      ['lesson_progress', 'lesson_progress'],
      ['call_logs', 'call_logs'],
      ['users', 'streak'],
    ])(
      'fails closed with a sanitized log when %s is unavailable',
      async (table, stage) => {
        await build(
          healthyResolvers({
            [table]: () => ({
              data: null,
              count: null,
              error: { code: 'PGRST123', message: 'secret provider detail' },
            }),
          }),
        );

        await expect(
          service.getReport('private-user-id', 'week'),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(errorSpy).toHaveBeenCalledWith(
          `performance_report.${stage}_failed code=PGRST123`,
        );
        const logs = errorSpy.mock.calls.flat().join(' ');
        expect(logs).not.toContain('private-user-id');
        expect(logs).not.toContain('secret provider detail');
      },
    );

    it('never logs an unsafe provider error code', async () => {
      await build(
        healthyResolvers({
          moments: () => ({
            count: null,
            error: { code: 'DROP TABLE users;--' },
          }),
        }),
      );

      await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        'performance_report.moments_failed',
      );
    });

    it('fails closed without leaking the cause when a query throws', async () => {
      await build(
        healthyResolvers({
          chat_messages: () => {
            throw new Error('connection string postgres://secret');
          },
        }),
      );

      await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        'performance_report.chat_messages_failed',
      );
      expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('secret');
    });

    it('refuses to report truncated study time at the call log row limit', async () => {
      await build(
        healthyResolvers({
          call_logs: () => ({
            data: Array.from({ length: 10_000 }, () =>
              callLog('2026-11-09T10:00:00.000Z', 60),
            ),
            error: null,
          }),
        }),
      );

      await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'performance_report.call_logs_result_limit_failed',
      );
    });

    it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 2])(
      'rejects the malformed count %s instead of reporting it',
      async (count) => {
        await build(
          healthyResolvers({
            moments: () => ({ count, error: null }),
          }),
        );

        await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(errorSpy).toHaveBeenCalledWith(
          'performance_report.invalid_count_failed',
        );
      },
    );

    it('rejects a malformed streak value', async () => {
      await build(
        healthyResolvers({
          users: () => ({ data: { study_streak_days: -3 }, error: null }),
        }),
      );

      await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('propagates an unavailable achievement store instead of omitting badges', async () => {
      achievements.getUnlockedBetween.mockRejectedValue(
        new ServiceUnavailableException(
          'Achievements are temporarily unavailable',
        ),
      );
      await build(healthyResolvers());

      await expect(service.getReport('user-1')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
