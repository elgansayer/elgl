import { Test, TestingModule } from '@nestjs/testing';
import { StreakService } from './streak.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('StreakService', () => {
  let service: StreakService;
  let supabaseMock: any;

  beforeEach(async () => {
    // Create a mock query builder chain that covers the full Supabase PostgREST
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
      ];
      methods.forEach((method) => {
        chain[method] = jest.fn().mockReturnValue(chain);
      });

      // Promisify the chain so that `await` works after the final `.lt` / `.in` call.
      let resolveData: any = null;
      chain._setResolveData = (data: any) => {
        resolveData = data;
      };
      chain.then = (resolve: any) => {
        if (resolveData) {
          resolve(resolveData);
          resolveData = null;
        }
        return chain;
      };
      return chain;
    };

    supabaseMock = {
      from: jest.fn().mockReturnValue(createQueryChain()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreakService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn().mockReturnValue(supabaseMock),
          },
        },
      ],
    }).compile();

    service = module.get<StreakService>(StreakService);
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

      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: mockInactiveUsers, error: null });
      chain.update.mockReturnValue(chain);
      chain.in.mockResolvedValue({ data: mockInactiveUsers, error: null });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(2);
      expect(chain.update).toHaveBeenCalledWith({ study_streak_days: 0 });
      expect(chain.in).toHaveBeenCalledWith('id', ['user-1', 'user-2']);
    });

    it('should return 0 when no inactive users found', async () => {
      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: [], error: null });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });

    it('should return 0 on query error', async () => {
      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
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

      const chain = supabaseMock.from();
      chain.select.mockReturnValue(chain);
      chain.gt.mockReturnValue(chain);
      chain.lt.mockResolvedValue({ data: mockInactiveUsers, error: null });
      chain.update.mockReturnValue(chain);
      // Return an error while still providing data so the service can decide the
      // codepath based on the error without throwing on a missing `data` field.
      chain.in.mockResolvedValue({
        data: [],
        error: { message: 'Update failed' },
      });

      const result = await service.resetStreaksForTesting();
      expect(result).toBe(0);
    });
  });
});
