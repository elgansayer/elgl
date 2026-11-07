import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SafetyService } from './safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { SafetyCacheInvalidationService } from './safety-cache-invalidation.service';
import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY } from './safety.constants';

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

/**
 * Chainable Supabase query fake. `maybeSingle` and `single` consume queued
 * results in order; awaiting the builder itself (count, upsert, delete queries)
 * resolves `awaited`.
 */
function createFakeQuery(
  options: {
    maybeSingle?: QueryResult[];
    single?: QueryResult[];
    awaited?: QueryResult[];
  } = {},
) {
  const maybeSingle = [...(options.maybeSingle ?? [])];
  const single = [...(options.single ?? [])];
  const awaited = [...(options.awaited ?? [])];
  const builder: Record<string, any> = {};
  for (const method of [
    'select',
    'eq',
    'in',
    'gte',
    'order',
    'limit',
    'insert',
    'upsert',
    'delete',
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve(maybeSingle.shift() ?? { data: null, error: null }),
  );
  builder.single = vi.fn(() =>
    Promise.resolve(single.shift() ?? { data: null, error: null }),
  );
  builder.then = (resolve: (value: unknown) => unknown, reject: never) =>
    Promise.resolve(
      awaited.shift() ?? { data: [], error: null, count: 0 },
    ).then(resolve, reject);
  return builder;
}

const REPORTER = '11111111-1111-4111-8111-111111111111';
const TARGET = '22222222-2222-4222-8222-222222222222';
const REPORT_ID = '33333333-3333-4333-8333-333333333333';

const flushBackgroundWork = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

describe('SafetyService', () => {
  let service: SafetyService;
  let mockSupabaseClient: any;
  let mockQueryBuilder: any;
  let mockMetricsService: any;
  let mockCacheInvalidationService: {
    invalidateTrustAndSafetyCaches: Mock;
    invalidateUserPairCaches: Mock;
    invalidateUserCaches: Mock;
  };

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    mockQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => resolve(mockQueryBuilder._response)),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    mockMetricsService = {
      recordTsReportSubmitted: vi.fn(),
      recordTsBlockCreated: vi.fn(),
      recordTsBlockRemoved: vi.fn(),
      recordTsSafetyOperation: vi.fn(),
      setTsPendingReports: vi.fn(),
      setTsActiveBlocksTotal: vi.fn(),
      recordTsModerationAction: vi.fn(),
      recordTsDatingRiskScore: vi.fn(),
    };

    mockCacheInvalidationService = {
      invalidateTrustAndSafetyCaches: vi.fn().mockResolvedValue(undefined),
      invalidateUserPairCaches: vi.fn().mockResolvedValue(undefined),
      invalidateUserCaches: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SafetyService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: SafetyCacheInvalidationService,
          useValue: mockCacheInvalidationService,
        },
      ],
    }).compile();

    service = module.get<SafetyService>(SafetyService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportUser', () => {
    let users: ReturnType<typeof createFakeQuery>;
    let reports: ReturnType<typeof createFakeQuery>;

    const useTables = (
      usersOptions: Parameters<typeof createFakeQuery>[0] = {
        maybeSingle: [{ data: { id: TARGET }, error: null }],
      },
      reportsOptions: Parameters<typeof createFakeQuery>[0] = {},
    ) => {
      users = createFakeQuery(usersOptions);
      reports = createFakeQuery({
        // 1st maybeSingle: open-report lookup. 1st awaited: quota count.
        maybeSingle: [{ data: null, error: null }],
        awaited: [{ count: 0, error: null }],
        single: [{ data: { id: REPORT_ID }, error: null }],
        ...reportsOptions,
      });
      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'users' ? users : reports,
      );
    };

    const dto = {
      reported_id: TARGET,
      reason_category: 'harassment' as const,
      description: 'Harassed me',
      context_url: '/chat/room-1',
    };

    beforeEach(() => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    });

    it('creates a report for a personal or business account and returns its id', async () => {
      useTables();

      const result = await service.reportUser(REPORTER, dto);

      expect(result).toEqual({ id: REPORT_ID, duplicate: false });
      expect(users.eq).toHaveBeenCalledWith('id', TARGET);
      expect(reports.insert).toHaveBeenCalledWith({
        reporter_id: REPORTER,
        reported_user_id: TARGET,
        reason_category: 'harassment',
        description: 'Harassed me',
        context_url: '/chat/room-1',
        status: 'pending',
      });
      expect(mockMetricsService.recordTsReportSubmitted).toHaveBeenCalledWith(
        'harassment',
      );
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'success',
      );
      expect(
        mockCacheInvalidationService.invalidateUserCaches,
      ).toHaveBeenCalledWith(TARGET);
      expect(
        mockCacheInvalidationService.invalidateTrustAndSafetyCaches,
      ).toHaveBeenCalled();
    });

    it('stores blank optional text as null', async () => {
      useTables();

      await service.reportUser(REPORTER, {
        reported_id: TARGET,
        reason_category: 'spam',
        description: '   ',
        context_url: '',
      });

      expect(reports.insert).toHaveBeenCalledWith(
        expect.objectContaining({ description: null, context_url: null }),
      );
    });

    it('logs a structured event without the description or context link', async () => {
      useTables();
      const logSpy = vi.mocked(Logger.prototype.log);

      await service.reportUser(REPORTER, dto);

      const lines = logSpy.mock.calls.map(([line]) => String(line)).join('\n');
      expect(JSON.parse(String(logSpy.mock.calls[0][0]))).toEqual({
        event: 'safety.report.created',
        reportId: REPORT_ID,
        category: 'harassment',
      });
      expect(lines).not.toContain('Harassed me');
      expect(lines).not.toContain('/chat/room-1');
      expect(lines).not.toContain(REPORTER);
      expect(lines).not.toContain(TARGET);
    });

    it('rejects self-reports before touching persistence', async () => {
      await expect(
        service.reportUser(REPORTER, { ...dto, reported_id: REPORTER }),
      ).rejects.toThrow(new BadRequestException('Cannot report yourself'));

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'rejected',
      );
    });

    it('treats an upper-case copy of the reporter id as a self-report', async () => {
      await expect(
        service.reportUser(REPORTER, {
          ...dto,
          reported_id: REPORTER.toUpperCase(),
        }),
      ).rejects.toThrow(new BadRequestException('Cannot report yourself'));

      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('looks up, stores and caches the canonical lower-case ids', async () => {
      useTables();

      await service.reportUser(REPORTER.toUpperCase(), {
        ...dto,
        reported_id: TARGET.toUpperCase(),
      });

      expect(users.eq).toHaveBeenCalledWith('id', TARGET);
      expect(reports.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          reporter_id: REPORTER,
          reported_user_id: TARGET,
        }),
      );
      expect(
        mockCacheInvalidationService.invalidateUserCaches,
      ).toHaveBeenCalledWith(TARGET);
    });

    it('fails with not found when the reported account does not exist', async () => {
      useTables({ maybeSingle: [{ data: null, error: null }] });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(reports.insert).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'rejected',
      );
    });

    it('does not mistake a failed account lookup for a missing account', async () => {
      useTables({
        maybeSingle: [
          { data: null, error: { code: '08006', message: 'down' } },
        ],
      });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(reports.insert).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'failure',
      );
    });

    it('returns the existing open report instead of creating a duplicate', async () => {
      useTables(undefined, {
        maybeSingle: [{ data: { id: 'existing-report' }, error: null }],
      });

      const result = await service.reportUser(REPORTER, dto);

      expect(result).toEqual({ id: 'existing-report', duplicate: true });
      expect(reports.eq).toHaveBeenCalledWith('status', 'pending');
      expect(reports.eq).toHaveBeenCalledWith('reason_category', 'harassment');
      expect(reports.insert).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'duplicate',
      );
      expect(
        mockCacheInvalidationService.invalidateUserCaches,
      ).not.toHaveBeenCalled();
    });

    it('does not count a retry of an open report against the daily limit', async () => {
      useTables(undefined, {
        maybeSingle: [{ data: { id: 'existing-report' }, error: null }],
        awaited: [
          { count: SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY, error: null },
        ],
      });

      await expect(service.reportUser(REPORTER, dto)).resolves.toEqual({
        id: 'existing-report',
        duplicate: true,
      });
    });

    it('rejects a new report once the rolling daily limit is reached', async () => {
      useTables(undefined, {
        awaited: [
          { count: SAFETY_MAX_REPORTS_PER_REPORTER_PER_DAY, error: null },
        ],
      });

      const failure = await service.reportUser(REPORTER, dto).catch((e) => e);

      expect(failure).toBeInstanceOf(HttpException);
      expect(failure.getStatus()).toBe(429);
      expect(reports.insert).not.toHaveBeenCalled();
      expect(reports.gte).toHaveBeenCalledWith(
        'created_at',
        expect.any(String),
      );
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'rate_limited',
      );
      expect(
        JSON.parse(String(vi.mocked(Logger.prototype.warn).mock.calls[0][0])),
      ).toEqual({ event: 'safety.report.rate_limited', actorId: REPORTER });
    });

    it('counts only the reporter user-facing categories toward the limit', async () => {
      useTables();

      await service.reportUser(REPORTER, dto);

      expect(reports.select).toHaveBeenCalledWith('id', {
        count: 'exact',
        head: true,
      });
      expect(reports.in).toHaveBeenCalledWith('reason_category', [
        'harassment',
        'spam',
        'inappropriate_content',
        'fake_profile',
        'other',
      ]);
    });

    it('fails open when the limit check itself errors, because the insert still decides', async () => {
      useTables(undefined, {
        awaited: [
          { count: null, error: { code: '57014', message: 'timeout' } },
        ],
      });

      await expect(service.reportUser(REPORTER, dto)).resolves.toEqual({
        id: REPORT_ID,
        duplicate: false,
      });
    });

    it('converges on the winning row when a racing request takes the unique slot', async () => {
      useTables(undefined, {
        // lookup before insert: nothing; lookup after unique violation: winner
        maybeSingle: [
          { data: null, error: null },
          { data: { id: 'winner-report' }, error: null },
        ],
        single: [{ data: null, error: { code: '23505', message: 'dup' } }],
      });

      await expect(service.reportUser(REPORTER, dto)).resolves.toEqual({
        id: 'winner-report',
        duplicate: true,
      });
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
    });

    it('collapses two concurrent identical submissions into one moderation item', async () => {
      // Emulates the partial unique index: the first insert wins, the second
      // receives a unique violation and must converge on the winner's row.
      let storedId: string | null = null;
      let lookups = 0;
      useTables(
        {
          maybeSingle: [
            { data: { id: TARGET }, error: null },
            { data: { id: TARGET }, error: null },
          ],
        },
        { awaited: [{ count: 0 }, { count: 0 }] },
      );
      reports.maybeSingle = vi.fn(() => {
        lookups += 1;
        // Lookups 1 and 2 are the racing pre-insert checks; both see nothing.
        return Promise.resolve({
          data: lookups > 2 && storedId ? { id: storedId } : null,
          error: null,
        });
      });
      reports.single = vi.fn(() => {
        if (storedId) {
          return Promise.resolve({
            data: null,
            error: { code: '23505', message: 'dup' },
          });
        }
        storedId = REPORT_ID;
        return Promise.resolve({ data: { id: REPORT_ID }, error: null });
      });

      const results = await Promise.all([
        service.reportUser(REPORTER, dto),
        service.reportUser(REPORTER, dto),
      ]);

      expect(results.map((r) => r.id)).toEqual([REPORT_ID, REPORT_ID]);
      expect(results.filter((r) => r.duplicate)).toHaveLength(1);
      expect(mockMetricsService.recordTsReportSubmitted).toHaveBeenCalledTimes(
        1,
      );
    });

    it('reports a failure when the unique slot is taken but no row can be found', async () => {
      useTables(undefined, {
        maybeSingle: [
          { data: null, error: null },
          { data: null, error: null },
        ],
        single: [{ data: null, error: { code: '23505', message: 'dup' } }],
      });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('treats a vanished target (foreign key violation) as not found', async () => {
      useTables(undefined, {
        single: [{ data: null, error: { code: '23503', message: 'fk' } }],
      });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not leak provider detail when the insert fails', async () => {
      useTables(undefined, {
        single: [
          {
            data: null,
            error: { code: '42501', message: 'secret provider detail' },
          },
        ],
      });
      const errorSpy = vi.mocked(Logger.prototype.error);

      const failure = await service.reportUser(REPORTER, dto).catch((e) => e);

      expect(failure).toBeInstanceOf(InternalServerErrorException);
      expect(failure.message).toBe('Unable to submit report');
      const logged = errorSpy.mock.calls
        .map(([line]) => String(line))
        .join('\n');
      expect(logged).toContain('safety.report.insert_failed');
      expect(logged).toContain('42501');
      expect(logged).not.toContain('secret provider detail');
      expect(logged).not.toContain('Harassed me');
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'report',
        'failure',
      );
    });

    it('fails when the insert returns no row', async () => {
      useTables(undefined, { single: [{ data: null, error: null }] });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(mockMetricsService.recordTsReportSubmitted).not.toHaveBeenCalled();
    });

    it('surfaces a failed duplicate lookup as a service error', async () => {
      useTables(undefined, {
        maybeSingle: [{ data: null, error: { code: '57014', message: 'x' } }],
      });

      await expect(service.reportUser(REPORTER, dto)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
      expect(reports.insert).not.toHaveBeenCalled();
    });

    it('still succeeds when cache invalidation fails, without an unhandled rejection', async () => {
      useTables();
      mockCacheInvalidationService.invalidateUserCaches.mockRejectedValue(
        new Error('redis down'),
      );
      const unhandled = vi.fn();
      process.once('unhandledRejection', unhandled);

      await expect(service.reportUser(REPORTER, dto)).resolves.toEqual({
        id: REPORT_ID,
        duplicate: false,
      });
      await flushBackgroundWork();
      process.off('unhandledRejection', unhandled);

      expect(unhandled).not.toHaveBeenCalled();
      expect(
        vi
          .mocked(Logger.prototype.warn)
          .mock.calls.some(([line]) =>
            String(line).includes('safety.cache_invalidation_failed'),
          ),
      ).toBe(true);
    });
  });

  describe('blockUser', () => {
    let users: ReturnType<typeof createFakeQuery>;
    let blocks: ReturnType<typeof createFakeQuery>;

    const useTables = (
      blocksOptions: Parameters<typeof createFakeQuery>[0] = {
        awaited: [{ data: [{ id: 'block-1' }], error: null }],
      },
      usersOptions: Parameters<typeof createFakeQuery>[0] = {
        maybeSingle: [{ data: { id: TARGET }, error: null }],
      },
    ) => {
      users = createFakeQuery(usersOptions);
      blocks = createFakeQuery(blocksOptions);
      mockSupabaseClient.from.mockImplementation((table: string) =>
        table === 'users' ? users : blocks,
      );
    };

    beforeEach(() => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });

    it('creates a block through an idempotent upsert and records it', async () => {
      useTables();

      const result = await service.blockUser(REPORTER, { blocked_id: TARGET });

      expect(result).toEqual({
        success: true,
        blocked_id: TARGET,
        already_blocked: false,
      });
      expect(blocks.upsert).toHaveBeenCalledWith(
        { blocker_id: REPORTER, blocked_id: TARGET },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
      expect(blocks.select).toHaveBeenCalledWith('id');
      expect(mockMetricsService.recordTsBlockCreated).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'block',
        'success',
      );
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
      expect(
        mockCacheInvalidationService.invalidateTrustAndSafetyCaches,
      ).toHaveBeenCalled();
    });

    it('treats a repeated block as a successful no-op and refreshes caches', async () => {
      useTables({ awaited: [{ data: [], error: null }] });

      const result = await service.blockUser(REPORTER, { blocked_id: TARGET });

      expect(result).toEqual({
        success: true,
        blocked_id: TARGET,
        already_blocked: true,
      });
      expect(mockMetricsService.recordTsBlockCreated).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'block',
        'duplicate',
      );
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
    });

    it('stays correct when two identical block requests race', async () => {
      // Both requests resolve the target before either writes; the unique
      // constraint lets only the first insert create a row.
      useTables(
        {
          awaited: [
            { data: [{ id: 'block-1' }], error: null },
            { data: [], error: null },
          ],
        },
        {
          maybeSingle: [
            { data: { id: TARGET }, error: null },
            { data: { id: TARGET }, error: null },
          ],
        },
      );

      const results = await Promise.all([
        service.blockUser(REPORTER, { blocked_id: TARGET }),
        service.blockUser(REPORTER, { blocked_id: TARGET }),
      ]);

      expect(results.every((r) => r.success)).toBe(true);
      expect(results.filter((r) => r.already_blocked)).toHaveLength(1);
      expect(mockMetricsService.recordTsBlockCreated).toHaveBeenCalledTimes(1);
    });

    it('uses the same boundary for a business account without a separate table', async () => {
      useTables();

      await service.blockUser(REPORTER, { blocked_id: TARGET });

      const tables = mockSupabaseClient.from.mock.calls.map(
        ([table]: [string]) => table,
      );
      expect(tables).toEqual(['users', 'blocks']);
    });

    it('rejects self-blocking before touching persistence', async () => {
      await expect(
        service.blockUser(REPORTER, { blocked_id: REPORTER }),
      ).rejects.toThrow(new BadRequestException('You cannot block yourself'));
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('treats an upper-case copy of the caller id as a self-block', async () => {
      await expect(
        service.blockUser(REPORTER, { blocked_id: REPORTER.toUpperCase() }),
      ).rejects.toThrow(new BadRequestException('You cannot block yourself'));
      expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    });

    it('writes, caches and echoes the canonical lower-case ids', async () => {
      useTables();

      const result = await service.blockUser(REPORTER.toUpperCase(), {
        blocked_id: TARGET.toUpperCase(),
      });

      expect(result).toEqual({
        success: true,
        blocked_id: TARGET,
        already_blocked: false,
      });
      expect(users.eq).toHaveBeenCalledWith('id', TARGET);
      expect(blocks.upsert).toHaveBeenCalledWith(
        { blocker_id: REPORTER, blocked_id: TARGET },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
      );
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
    });

    it('fails with not found when the target does not exist', async () => {
      useTables(undefined, { maybeSingle: [{ data: null, error: null }] });

      await expect(
        service.blockUser(REPORTER, { blocked_id: TARGET }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(blocks.upsert).not.toHaveBeenCalled();
    });

    it('treats a target removed mid-request (foreign key violation) as not found', async () => {
      useTables({
        awaited: [{ data: null, error: { code: '23503', message: 'fk' } }],
      });

      await expect(
        service.blockUser(REPORTER, { blocked_id: TARGET }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a sanitised error when the write fails', async () => {
      useTables({
        awaited: [
          { data: null, error: { code: '42501', message: 'private detail' } },
        ],
      });
      const errorSpy = vi.mocked(Logger.prototype.error);

      const failure = await service
        .blockUser(REPORTER, { blocked_id: TARGET })
        .catch((e) => e);

      expect(failure).toBeInstanceOf(InternalServerErrorException);
      expect(failure.message).toBe('Unable to block user');
      const logged = errorSpy.mock.calls
        .map(([line]) => String(line))
        .join('\n');
      expect(logged).toContain('safety.block.insert_failed');
      expect(logged).not.toContain('private detail');
      expect(mockMetricsService.recordTsBlockCreated).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'block',
        'failure',
      );
    });
  });

  describe('unblockUser', () => {
    let blocks: ReturnType<typeof createFakeQuery>;

    const useBlocks = (options: Parameters<typeof createFakeQuery>[0]) => {
      blocks = createFakeQuery(options);
      mockSupabaseClient.from.mockImplementation(() => blocks);
    };

    beforeEach(() => {
      vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    });

    it('removes only the caller block and records the removal', async () => {
      useBlocks({ awaited: [{ data: [{ id: 'block-1' }], error: null }] });

      const result = await service.unblockUser(REPORTER, TARGET);

      expect(result).toEqual({ success: true });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(blocks.delete).toHaveBeenCalled();
      expect(blocks.eq).toHaveBeenCalledWith('blocker_id', REPORTER);
      expect(blocks.eq).toHaveBeenCalledWith('blocked_id', TARGET);
      expect(mockMetricsService.recordTsBlockRemoved).toHaveBeenCalledTimes(1);
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'unblock',
        'success',
      );
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
    });

    it('deletes and refreshes caches using the canonical lower-case ids', async () => {
      useBlocks({ awaited: [{ data: [{ id: 'block-1' }], error: null }] });

      await service.unblockUser(REPORTER.toUpperCase(), TARGET.toUpperCase());

      expect(blocks.eq).toHaveBeenCalledWith('blocker_id', REPORTER);
      expect(blocks.eq).toHaveBeenCalledWith('blocked_id', TARGET);
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
    });

    it('is a successful no-op when nothing was blocked, and does not inflate the metric', async () => {
      useBlocks({ awaited: [{ data: [], error: null }] });

      await expect(service.unblockUser(REPORTER, TARGET)).resolves.toEqual({
        success: true,
      });
      expect(mockMetricsService.recordTsBlockRemoved).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'unblock',
        'duplicate',
      );
      expect(
        mockCacheInvalidationService.invalidateUserPairCaches,
      ).toHaveBeenCalledWith(REPORTER, TARGET);
    });

    it('returns a sanitised error when the delete fails', async () => {
      useBlocks({
        awaited: [
          { data: null, error: { code: 'XX000', message: 'private detail' } },
        ],
      });
      const errorSpy = vi.mocked(Logger.prototype.error);

      const failure = await service
        .unblockUser(REPORTER, TARGET)
        .catch((e) => e);

      expect(failure).toBeInstanceOf(InternalServerErrorException);
      expect(failure.message).toBe('Unable to unblock user');
      expect(
        errorSpy.mock.calls.map(([line]) => String(line)).join('\n'),
      ).not.toContain('private detail');
      expect(mockMetricsService.recordTsBlockRemoved).not.toHaveBeenCalled();
      expect(mockMetricsService.recordTsSafetyOperation).toHaveBeenCalledWith(
        'unblock',
        'failure',
      );
    });
  });

  describe('isBlocked', () => {
    it('should return true when block exists', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'block-1' },
        error: null,
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(true);
      expect(mockQueryBuilder.maybeSingle).toHaveBeenCalled();
    });

    it('should return false when block does not exist', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(false);
    });

    it('should return false on query error', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'db error' },
      });

      const result = await service.isBlocked('user-1', 'blocked-user');
      expect(result).toBe(false);
    });
  });

  describe('getCategories', () => {
    it('should return safety categories', () => {
      const result = service.getCategories();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('value');
      expect(result[0]).toHaveProperty('label');
      expect(result[0]).toHaveProperty('icon');
      expect(result[0]).toHaveProperty('description');
    });
  });

  describe('getBlockedUserIds', () => {
    it('should return list of blocked user IDs for a user', async () => {
      // Build chain: from('blocks').select('blocked_id').eq('blocker_id', userId)
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
          error: null,
        }),
      );
      mockQueryBuilder._response = {
        data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
        error: null,
      };

      const result = await service.getBlockedUserIds('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocked_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocker_id', 'user-1');
      expect(result).toEqual(['blocked-1', 'blocked-2']);
    });

    it('should return empty array when query returns no data', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getBlockedUserIds('user-1');
      expect(result).toEqual([]);
    });

    it('should return empty array when query results in error', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );
      mockQueryBuilder._response = { data: null, error: { message: 'error' } };

      const result = await service.getBlockedUserIds('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getBlockerUserIds', () => {
    it('should return list of blocker user IDs for a user', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({
          data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
          error: null,
        }),
      );
      mockQueryBuilder._response = {
        data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
        error: null,
      };

      const result = await service.getBlockerUserIds('user-1');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('blocks');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('blocker_id');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('blocked_id', 'user-1');
      expect(result).toEqual(['blocker-1', 'blocker-2']);
    });

    it('should return empty array when query returns no data', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: null }),
      );
      mockQueryBuilder._response = { data: null, error: null };

      const result = await service.getBlockerUserIds('user-1');
      expect(result).toEqual([]);
    });

    it('should return empty array when query results in error', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );
      mockQueryBuilder._response = { data: null, error: { message: 'error' } };

      const result = await service.getBlockerUserIds('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getBlockedAndBlockerIds', () => {
    it('should return union of blocked and blocker IDs', async () => {
      // First call: getBlockedUserIds
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocker_id: 'blocker-1' }, { blocker_id: 'blocker-2' }],
            error: null,
          }),
        );

      const result = await service.getBlockedAndBlockerIds('user-1');

      expect(result).toHaveLength(4);
      expect(result).toContain('blocked-1');
      expect(result).toContain('blocked-2');
      expect(result).toContain('blocker-1');
      expect(result).toContain('blocker-2');
    });

    it('should deduplicate overlapping IDs', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocked_id: 'shared' }, { blocked_id: 'blocked-1' }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({
            data: [{ blocker_id: 'shared' }, { blocker_id: 'blocker-1' }],
            error: null,
          }),
        );

      const result = await service.getBlockedAndBlockerIds('user-1');

      // shared should only appear once
      expect(result.filter((id) => id === 'shared')).toHaveLength(1);
      expect(result).toContain('blocked-1');
      expect(result).toContain('blocker-1');
    });

    it('should fail closed when either direction of the block graph fails', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: { message: 'database unavailable' } }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it('should fail closed when either block query has an invalid response', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: null, error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [], error: null }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it('should fail closed when either block query contains a malformed row', async () => {
      mockQueryBuilder.then = vi
        .fn()
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ blocked_id: 'blocked-1' }, {}], error: null }),
        )
        .mockImplementationOnce((resolve: any) =>
          resolve({ data: [{ blocker_id: 'blocker-1' }], error: null }),
        );

      await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
        'Failed to load complete block graph',
      );
    });

    it.each([
      [{ blocked_id: '' }, { blocker_id: 'blocker-1' }],
      [{ blocked_id: '   ' }, { blocker_id: 'blocker-1' }],
      [{ blocked_id: 'blocked-1' }, { blocker_id: '' }],
      [{ blocked_id: 'blocked-1' }, { blocker_id: ' padded ' }],
    ])(
      'should fail closed for blank or padded block IDs',
      async (blockedRow, blockerRow) => {
        mockQueryBuilder.then = vi
          .fn()
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [blockedRow], error: null }),
          )
          .mockImplementationOnce((resolve: any) =>
            resolve({ data: [blockerRow], error: null }),
          );

        await expect(service.getBlockedAndBlockerIds('user-1')).rejects.toThrow(
          'Failed to load complete block graph',
        );
      },
    );
  });

  describe('getBlockedUserDetails', () => {
    it('should return empty array when no blocked users', async () => {
      mockQueryBuilder.then = vi.fn((resolve: any) =>
        resolve({ data: [], error: null }),
      );
      mockQueryBuilder._response = { data: [], error: null };

      const result = await service.getBlockedUserDetails('user-1');
      expect(result).toEqual([]);
    });

    it('should return blocked user details', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }, { blocked_id: 'blocked-2' }],
          error: null,
        }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [
            {
              id: 'blocked-1',
              display_name: 'Blocked One',
              avatar_url: '/avatar1.png',
              native_language: 'en',
              target_languages: ['es'],
            },
            {
              id: 'blocked-2',
              display_name: 'Blocked Two',
              avatar_url: null,
              native_language: 'fr',
              target_languages: ['de', 'it'],
            },
          ],
          error: null,
        }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getBlockedUserDetails('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'blocked-1',
        display_name: 'Blocked One',
        avatar_url: '/avatar1.png',
        native_language: 'en',
        target_language: 'es',
      });
      expect(result[1]).toEqual({
        id: 'blocked-2',
        display_name: 'Blocked Two',
        avatar_url: null,
        native_language: 'fr',
        target_language: 'de',
      });
    });

    it('should return empty array when user details query fails', async () => {
      const mockBlocksBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockBlocksBuilder.then.mockImplementation((resolve: any) =>
        resolve({
          data: [{ blocked_id: 'blocked-1' }],
          error: null,
        }),
      );

      const mockUsersBuilder = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: vi.fn(),
      };
      mockUsersBuilder.then.mockImplementation((resolve: any) =>
        resolve({ data: null, error: { message: 'error' } }),
      );

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'blocks') return mockBlocksBuilder;
        if (table === 'users') return mockUsersBuilder;
        return mockQueryBuilder;
      });

      const result = await service.getBlockedUserDetails('user-1');
      expect(result).toEqual([]);
    });
  });
});
