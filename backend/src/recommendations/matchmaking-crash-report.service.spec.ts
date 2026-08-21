import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MatchmakingCrashReportService,
  MatchmakingCrashReportPayload,
} from './matchmaking-crash-report.service';
import { SupabaseService } from '../supabase/supabase.service';

type CrashReportQueryBuilder = {
  select: Mock;
  insert: Mock;
  update: Mock;
  eq: Mock;
  is: Mock;
  order: Mock;
  limit: Mock;
  single: Mock;
};

describe('MatchmakingCrashReportService', () => {
  let service: MatchmakingCrashReportService;
  let mockSupabaseClient: { from: Mock };
  let mockQueryBuilder: CrashReportQueryBuilder;

  beforeEach(async () => {
    mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient = {
      from: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingCrashReportService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(mockSupabaseClient),
          },
        },
      ],
    }).compile();

    service = module.get<MatchmakingCrashReportService>(
      MatchmakingCrashReportService,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportCrash', () => {
    const crashPayload: MatchmakingCrashReportPayload = {
      operation: 'getRecommendations',
      user_id: 'user-1',
      error_type: 'InternalServerError',
      error_message: 'Database connection failed',
      stack_trace: 'Error: Database connection failed\n    at ...',
      context: { tier: 'interest' },
      circuit_breaker_open: false,
      degraded_tier: 'language_exchange',
    };

    it('should persist a crash report and return it', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'crash-1',
          operation: 'getRecommendations',
          user_id: 'user-1',
          error_type: 'InternalServerError',
          error_message: 'Database connection failed',
          stack_trace: 'Error: Database connection failed\n    at ...',
          context: { tier: 'interest' },
          circuit_breaker_open: false,
          degraded_tier: 'language_exchange',
          created_at: '2026-08-07T00:00:00Z',
          acknowledged: false,
          resolved_at: null,
        },
        error: null,
      });

      const result = await service.reportCrash(crashPayload);

      expect(result).toBeDefined();
      expect(result!.id).toBe('crash-1');
      expect(result!.operation).toBe('getRecommendations');
      expect(result!.degraded_tier).toBe('language_exchange');
      expect(result!.acknowledged).toBe(false);
      expect(result!.resolved_at).toBeNull();
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        operation: 'getRecommendations',
        user_id: 'user-1',
        error_type: 'InternalServerError',
        error_message: 'Database connection failed',
        stack_trace: 'Error: Database connection failed\n    at ...',
        context: { tier: 'interest' },
        circuit_breaker_open: false,
        degraded_tier: 'language_exchange',
        acknowledged: false,
      });
    });

    it('should return null when database insert fails', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.reportCrash(crashPayload);
      expect(result).toBeNull();
    });

    it('should return null when supabase call throws', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.reportCrash(crashPayload);
      expect(result).toBeNull();
    });

    it('should handle null optional fields gracefully', async () => {
      const minimalPayload: MatchmakingCrashReportPayload = {
        operation: 'getDailyRecommendations',
        error_type: 'TimeoutError',
        error_message: 'Request timed out',
      };

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'crash-2',
          operation: 'getDailyRecommendations',
          user_id: null,
          error_type: 'TimeoutError',
          error_message: 'Request timed out',
          stack_trace: null,
          context: null,
          circuit_breaker_open: false,
          degraded_tier: null,
          created_at: '2026-08-07T00:00:00Z',
          acknowledged: false,
          resolved_at: null,
        },
        error: null,
      });

      const result = await service.reportCrash(minimalPayload);
      expect(result).toBeDefined();
      expect(result!.user_id).toBeUndefined();
      expect(result!.stack_trace).toBeUndefined();
      expect(result!.circuit_breaker_open).toBe(false);
    });
  });

  describe('listUnresolved', () => {
    it('should return unresolved crash reports', async () => {
      mockQueryBuilder.limit = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: 'crash-1',
            operation: 'getRecommendations',
            user_id: 'user-1',
            error_type: 'RollbackFailure',
            error_message: 'Rollback failed',
            stack_trace: null,
            context: null,
            circuit_breaker_open: true,
            degraded_tier: 'mock',
            created_at: '2026-08-07T00:00:00Z',
            acknowledged: false,
            resolved_at: null,
          },
        ],
        error: null,
      });

      const result = await service.listUnresolved();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('crash-1');
      expect(result[0].circuit_breaker_open).toBe(true);
      expect(result[0].degraded_tier).toBe('mock');
    });

    it('should return empty array when list fails', async () => {
      mockQueryBuilder.limit = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });

    it('should return empty array on exception', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.listUnresolved();
      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeReport', () => {
    it('should acknowledge a crash report', async () => {
      mockQueryBuilder.eq = vi.fn().mockResolvedValueOnce({
        error: null,
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.eq = vi.fn().mockResolvedValueOnce({
        error: { message: 'Not found' },
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockQueryBuilder.eq = vi.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.acknowledgeReport('crash-1');
      expect(result).toBe(false);
    });
  });

  describe('resolveReport', () => {
    it('should resolve a crash report', async () => {
      mockQueryBuilder.eq = vi.fn().mockResolvedValueOnce({
        error: null,
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      mockQueryBuilder.eq = vi.fn().mockResolvedValueOnce({
        error: { message: 'Not found' },
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockQueryBuilder.eq = vi.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const result = await service.resolveReport('crash-1');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return stats with tier and operation breakdown', async () => {
      mockQueryBuilder.select = vi.fn().mockReturnValue({
        data: [
          {
            id: 'crash-1',
            operation: 'getRecommendations',
            error_type: 'DBError',
            error_message: 'Failed',
            degraded_tier: 'language_exchange',
            resolved_at: null,
          },
          {
            id: 'crash-2',
            operation: 'getRecommendations',
            error_type: 'TimeoutError',
            error_message: 'Timeout',
            degraded_tier: 'mock',
            resolved_at: '2026-08-07T00:00:00Z',
          },
          {
            id: 'crash-3',
            operation: 'getDailyRecommendations',
            error_type: 'ConnectionError',
            error_message: 'Connection refused',
            degraded_tier: null,
            resolved_at: null,
          },
        ],
        error: null,
      });

      const stats = await service.getStats();

      expect(stats.total).toBe(3);
      expect(stats.unresolved).toBe(2);
      expect(stats.by_tier).toEqual({
        language_exchange: 1,
        mock: 1,
        none: 1,
      });
      expect(stats.by_operation).toEqual({
        getRecommendations: 2,
        getDailyRecommendations: 1,
      });
    });

    it('should return zero stats on error', async () => {
      mockQueryBuilder.select = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      const stats = await service.getStats();
      expect(stats.total).toBe(0);
    });

    it('should return zero stats on exception', async () => {
      mockSupabaseClient.from = vi.fn().mockImplementation(() => {
        throw new Error('Connection refused');
      });

      const stats = await service.getStats();
      expect(stats.total).toBe(0);
    });
  });
});
