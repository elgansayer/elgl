import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingErrorBoundaryService } from './matchmaking-error-boundary.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from '../metrics/metrics.service';
import { InternalServerErrorException } from '@nestjs/common';

type QueryChainMock = {
  insert: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  is: jest.Mock;
  update: jest.Mock;
  _setResolve: (data: unknown, error?: { message: string } | null) => void;
  then: (resolve: (value: unknown) => void) => undefined;
};

const makeQueryChain = (): QueryChainMock => {
  const resolveHolder: { data: unknown; error: { message: string } | null } = {
    data: null,
    error: null,
  };

  const chain = {
    _setResolve(data: unknown, error: { message: string } | null = null) {
      resolveHolder.data = data;
      resolveHolder.error = error;
    },
  } as Partial<QueryChainMock>;

  const methodNames = [
    'insert',
    'select',
    'eq',
    'order',
    'limit',
    'single',
    'is',
    'update',
  ];
  methodNames.forEach((m) => {
    (chain as Record<string, unknown>)[m] = jest.fn().mockReturnValue(chain);
  });

  (chain as Record<string, unknown>)['then'] = (
    resolve: (value: unknown) => void,
  ) => {
    resolve(resolveHolder);
    return undefined;
  };

  return chain as QueryChainMock;
};

describe('MatchmakingErrorBoundaryService', () => {
  let service: MatchmakingErrorBoundaryService;
  let mockRedis: { get: jest.Mock; set: jest.Mock };
  let mockFrom: jest.Mock;
  let mockLogger: { error: jest.Mock; warn: jest.Mock; log: jest.Mock };

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };

    mockFrom = jest.fn();

    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingErrorBoundaryService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              from: mockFrom,
            }),
            getRedisClient: jest.fn().mockReturnValue(mockRedis),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            getRegister: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<MatchmakingErrorBoundaryService>(
      MatchmakingErrorBoundaryService,
    );

    // Override the logger with our mock
    (service as Record<string, unknown>)['logger'] = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reportCrash', () => {
    it('should persist a crash report to the database', async () => {
      const chain = makeQueryChain();
      chain._setResolve({
        id: 'crash-1',
        service_name: 'recommendations',
        operation: 'getRecommendations',
        user_id: 'user-1',
        error_type: 'TypeError',
        error_message: 'Cannot read property of undefined',
        stack_trace: 'Error: ...',
        context: { tier: 'language_exchange' },
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved_at: null,
      });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.reportCrash({
        operation: 'getRecommendations',
        service_name: 'recommendations',
        user_id: 'user-1',
        error_type: 'TypeError',
        error_message: 'Cannot read property of undefined',
        stack_trace: 'Error: ...',
        context: { tier: 'language_exchange' },
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('crash-1');
      expect(result!.service_name).toBe('recommendations');
      expect(result!.acknowledged).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log and cache in Redis when DB insert fails', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'DB connection refused' });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.reportCrash({
        operation: 'searchPartners',
        service_name: 'discovery',
        user_id: 'user-2',
        error_type: 'DatabaseError',
        error_message: 'Connection lost',
      });

      expect(result).toBeNull();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('crash:discovery:'),
        expect.any(String),
        'EX',
        3600,
      );
    });

    it('should handle null user_id gracefully', async () => {
      const chain = makeQueryChain();
      chain._setResolve({
        id: 'crash-2',
        service_name: 'recommendations',
        operation: 'calculateDaily',
        user_id: null,
        error_type: 'Error',
        error_message: 'Unknown',
        context: null,
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved_at: null,
      });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.reportCrash({
        operation: 'calculateDaily',
        service_name: 'recommendations',
        error_type: 'Error',
        error_message: 'Unknown',
      });

      expect(result).not.toBeNull();
      expect(result!.user_id).toBeUndefined();
    });

    it('should gracefully handle unexpected exception during persistence', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected fatal error');
      });

      const result = await service.reportCrash({
        operation: 'test',
        service_name: 'discovery',
        error_type: 'TestError',
        error_message: 'Testing',
      });

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ persist_error: expect.any(String) }),
        expect.stringContaining('Exception while persisting'),
      );
    });
  });

  describe('executeWithBoundary', () => {
    it('should return successful result when operation completes', async () => {
      const result = await service.executeWithBoundary(
        {
          operation: 'getRecommendations',
          service_name: 'recommendations',
          user_id: 'user-1',
          tier: 'interest',
        },
        async () => ['user-a', 'user-b'],
        async () => [],
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['user-a', 'user-b']);
      expect(result.degraded).toBe(false);
      expect(result.error_captured).toBe(false);
    });

    it('should execute fallback when operation fails and report the crash', async () => {
      const result = await service.executeWithBoundary(
        {
          operation: 'searchPartners',
          service_name: 'discovery',
          user_id: 'user-1',
          tier: 'language_exchange',
        },
        async () => {
          throw new Error('Database timeout');
        },
        async () => ['fallback-user'],
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['fallback-user']);
      expect(result.degraded).toBe(true);
      expect(result.error_captured).toBe(true);
      expect(result.fallback_reason).toContain('Database timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should report both primary and fallback failures when both fail', async () => {
      const result = await service.executeWithBoundary(
        {
          operation: 'getRecommendations',
          service_name: 'recommendations',
          user_id: 'user-1',
          tier: 'active_users',
        },
        async () => {
          throw new Error('Primary error');
        },
        async () => {
          throw new Error('Fallback error');
        },
      );

      expect(result.success).toBe(false);
      expect(result.degraded).toBe(true);
      expect(result.error_captured).toBe(true);
      expect(result.fallback_reason).toContain('Primary error');
      expect(result.fallback_reason).toContain('Fallback error');
    });

    it('should handle non-Error throws (strings/objects)', async () => {
      const result = await service.executeWithBoundary(
        {
          operation: 'test',
          service_name: 'recommendations',
        },
        async () => {
          throw 'raw string error';
        },
        async () => ['fallback'],
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(['fallback']);
      expect(result.degraded).toBe(true);
      expect(result.error_captured).toBe(true);
    });

    it('should handle InternalServerErrorException errors', async () => {
      const chain = makeQueryChain();
      chain._setResolve({
        id: 'crash-ise',
        service_name: 'recommendations',
        operation: 'test',
        error_type: 'InternalServerError',
        error_message: 'Server error',
        context: null,
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved_at: null,
      });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.executeWithBoundary(
        {
          operation: 'test',
          service_name: 'recommendations',
        },
        async () => {
          throw new InternalServerErrorException('Server error');
        },
        async () => ['fallback'],
      );

      expect(result.success).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('executeOrThrow', () => {
    it('should return result when operation succeeds', async () => {
      const result = await service.executeOrThrow(
        {
          operation: 'searchPartners',
          service_name: 'discovery',
          user_id: 'user-1',
        },
        async () => 'success',
      );

      expect(result).toBe('success');
    });

    it('should capture error and rethrow', async () => {
      const testError = new Error('Critical failure');

      await expect(
        service.executeOrThrow(
          {
            operation: 'test',
            service_name: 'recommendations',
          },
          async () => {
            throw testError;
          },
        ),
      ).rejects.toThrow('Critical failure');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('listUnresolved', () => {
    it('should return crash reports for admin triage', async () => {
      const chain = makeQueryChain();
      chain._setResolve([
        {
          id: 'crash-1',
          service_name: 'recommendations',
          operation: 'getRecommendations',
          user_id: 'user-1',
          error_type: 'TypeError',
          error_message: 'Error message',
          stack_trace: null,
          context: null,
          created_at: '2026-01-01T00:00:00Z',
          acknowledged: false,
          resolved_at: null,
        },
      ]);
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.listUnresolved(10);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('crash-1');
      expect(result[0].acknowledged).toBe(false);
    });

    it('should return empty array on DB error', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'DB error' });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.listUnresolved();

      expect(result).toEqual([]);
    });

    it('should return empty array on unexpected exception', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Fatal');
      });

      const result = await service.listUnresolved();

      expect(result).toEqual([]);
    });
  });

  describe('acknowledgeReport', () => {
    it('should acknowledge a crash report', async () => {
      const chain = makeQueryChain();
      chain._setResolve({});
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.acknowledgeReport('crash-1');

      expect(result).toBe(true);
    });

    it('should return false on DB error', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'Not found' });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.acknowledgeReport('crash-1');

      expect(result).toBe(false);
    });

    it('should return false on unexpected exception', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Fatal');
      });

      const result = await service.acknowledgeReport('crash-1');

      expect(result).toBe(false);
    });
  });

  describe('resolveReport', () => {
    it('should resolve a crash report', async () => {
      const chain = makeQueryChain();
      chain._setResolve({});
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.resolveReport('crash-1');

      expect(result).toBe(true);
    });

    it('should return false on DB error', async () => {
      const chain = makeQueryChain();
      chain._setResolve(null, { message: 'Not found' });
      mockFrom.mockReturnValueOnce(chain);

      const result = await service.resolveReport('crash-1');

      expect(result).toBe(false);
    });

    it('should return false on unexpected exception', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Fatal');
      });

      const result = await service.resolveReport('crash-1');

      expect(result).toBe(false);
    });
  });

  describe('captureError', () => {
    it('should capture and report an error', async () => {
      const chain = makeQueryChain();
      chain._setResolve({
        id: 'crash-captured',
        service_name: 'recommendations',
        operation: 'getRecommendations',
        user_id: 'user-1',
        error_type: 'Error',
        error_message: 'Test captured error',
        context: { tier: 'interest', degraded: false },
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved_at: null,
      });
      mockFrom.mockReturnValueOnce(chain);

      await service.captureError(new Error('Test captured error'), {
        operation: 'getRecommendations',
        service_name: 'recommendations',
        user_id: 'user-1',
        tier: 'interest',
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle non-Error values', async () => {
      const chain = makeQueryChain();
      chain._setResolve({
        id: 'crash-raw',
        service_name: 'discovery',
        operation: 'searchPartners',
        error_type: 'Error',
        error_message: 'raw error text',
        context: null,
        created_at: new Date().toISOString(),
        acknowledged: false,
        resolved_at: null,
      });
      mockFrom.mockReturnValueOnce(chain);

      await service.captureError('raw error text', {
        operation: 'searchPartners',
        service_name: 'discovery',
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});