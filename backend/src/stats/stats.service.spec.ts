import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from './stats.service';
import { SupabaseService } from '../supabase/supabase.service';

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
    'head',
    'not',
  ];
  methods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

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

describe('StatsService', () => {
  let service: StatsService;
  let supabaseMock: any;

  beforeEach(async () => {
    supabaseMock = {
      from: vi.fn(() => createQueryChain()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: vi.fn().mockReturnValue(supabaseMock),
          },
        },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStats', () => {
    it('should return stats with study_hours, messages_sent, corrections_count, moments_count', async () => {
      const callLogs = [
        { duration_seconds: 3600, started_at: new Date().toISOString() },
        { duration_seconds: 1800, started_at: new Date().toISOString() },
      ];

      const callIdx = 0;
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setResolveData({ data: callLogs, error: null });
        } else if (table === 'chat_messages') {
          chain._setResolveData({ data: null, count: 42, error: null });
        } else if (table === 'moment_comments') {
          chain._setResolveData({ data: null, count: 15, error: null });
        } else if (table === 'moments') {
          chain._setResolveData({ data: null, count: 5, error: null });
        }
        return chain;
      });

      const result = await service.getStats('user-1');

      expect(result).toHaveProperty('study_hours');
      expect(result).toHaveProperty('messages_sent');
      expect(result).toHaveProperty('corrections_count');
      expect(result).toHaveProperty('moments_count');
      expect(result.study_hours).toHaveLength(7);
      expect(result.messages_sent).toBe(42);
      expect(result.corrections_count).toBe(15);
      expect(result.moments_count).toBe(5);
    });

    it('should return zeroes when no data exists', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [], count: 0, error: null });
        return chain;
      });

      const result = await service.getStats('user-1');

      expect(result.messages_sent).toBe(0);
      expect(result.corrections_count).toBe(0);
      expect(result.moments_count).toBe(0);
      expect(result.study_hours.every((s: any) => s.hours === 0)).toBe(true);
    });

    it('should throw an error when call_logs query fails', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setRejectError(new Error('DB connection error'));
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      await expect(service.getStats('user-1')).rejects.toThrow(
        'DB connection error',
      );
    });

    it('should throw an error when chat_messages query fails', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setResolveData({ data: [], error: null });
        } else if (table === 'chat_messages') {
          chain._setRejectError(new Error('DB error'));
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      await expect(service.getStats('user-1')).rejects.toThrow('DB error');
    });

    it('should aggregate study hours across multiple days correctly', async () => {
      const now = new Date();
      const today = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);

      const callLogs = [
        { duration_seconds: 7200, started_at: today.toISOString() },
        { duration_seconds: 3600, started_at: yesterday.toISOString() },
        { duration_seconds: 900, started_at: today.toISOString() },
      ];

      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setResolveData({ data: callLogs, error: null });
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      const result = await service.getStats('user-1');

      const todayHours = result.study_hours.find(
        (s) =>
          s.day ===
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()],
      )!.hours;
      const yesterdayHours = result.study_hours.find(
        (s) =>
          s.day ===
          ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][yesterday.getDay()],
      )!.hours;

      // 7200 + 900 = 8100 seconds = 2.25 hours, rounded = 2.3
      expect(todayHours).toBe(2.3);
      // 3600 seconds = 1 hour
      expect(yesterdayHours).toBe(1.0);
    });
  });
});
