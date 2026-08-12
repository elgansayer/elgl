import { Test, TestingModule } from '@nestjs/testing';
import { StreakService } from './streak.service';
import { SupabaseService } from '../supabase/supabase.service';
import { Logger } from '@nestjs/common';

// Helper to create a mock query chain that mimics the Supabase PostgREST
// fluent API so the service doesn't throw when it calls methods like `.order`.
const createQueryChain = () => {
  const chain: any = {};
  const methods = [
    'select',
    'from',
    'gt',
    'gte',
    'lt',
    'lte',
    'neq',
    'eq',
    'order',
    'limit',
    'in',
    'update',
    'single',
    'maybeSingle',
    'or',
  ];
  methods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  // Promisify the chain so that `await` works after the final `.lt` / `.in` call.
  let resolveData: any = null;
  let rejectError: any = null;

  chain._setResolveData = (data: any) => {
    resolveData = data;
    rejectError = null;
  };

  chain._setRejectError = (err: any) => {
    rejectError = err;
    resolveData = null;
  };

  chain.then = (resolve: any, reject: any) => {
    if (rejectError) {
      reject(rejectError);
    } else {
      resolve(resolveData ?? { data: null, error: null });
    }
    return undefined;
  };

  return chain;
};

describe('StreakService', () => {
  let service: StreakService;
  let supabaseMock: any;

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    supabaseMock = {
      from: vi.fn(() => createQueryChain()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(supabaseMock),
          },
        },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resetStreaksForTesting', () => {
    it('should reset streaks for users inactive for more than 24 hours', async () => {
      const mockInactiveUsers = [
        {
          id: 'user-1',
          study_streak_days: 5,
          last_active_at: new Date(
            Date.now() - 48 * 60 * 60 * 1000,
          ).toISOString(),
        },
        {
          id: 'user-2',
          study_streak_days: 3,
          last_active_at: new Date(
            Date.now() - 36 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ];

      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: mockInactiveUsers, error: null });
        return chain;
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(2);
    });

    it('should return 0 when no inactive users found', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [], error: null });
        return chain;
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });

    it('should return 0 on query error', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({
          data: null,
          error: { message: 'DB error' },
        });
        return chain;
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });

    it('should return 0 on update error', async () => {
      const mockInactiveUsers = [
        {
          id: 'user-1',
          study_streak_days: 5,
          last_active_at: new Date(
            Date.now() - 48 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ];

      let callCount = 0;
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        callCount++;
        if (callCount === 1) {
          chain._setResolveData({ data: mockInactiveUsers, error: null });
        } else {
          chain._setResolveData({
            data: null,
            error: { message: 'Update failed' },
          });
        }
        return chain;
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });
  });
});
