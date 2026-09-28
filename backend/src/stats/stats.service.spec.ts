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
    it('returns the seven-day study series and lifetime activity counts', async () => {
      const callLogs = [
        { duration_seconds: 3600, started_at: new Date().toISOString() },
        { duration_seconds: 1800, started_at: new Date().toISOString() },
      ];

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

      expect(result.study_hours).toHaveLength(7);
      expect(result.study_hours.map(({ day }) => day)).toEqual([
        'Sun',
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat',
      ]);
      expect(result.messages_sent).toBe(42);
      expect(result.corrections_count).toBe(15);
      expect(result.moments_count).toBe(5);
    });

    it('bounds the weekly call-log read', async () => {
      let callLogChain: any;
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [], count: 0, error: null });
        if (table === 'call_logs') callLogChain = chain;
        return chain;
      });

      await service.getStats('user-1');

      expect(callLogChain.limit).toHaveBeenCalledWith(10_000);
    });

    it('returns zeroes when no data exists', async () => {
      supabaseMock.from.mockImplementation(() => {
        const chain = createQueryChain();
        chain._setResolveData({ data: [], count: 0, error: null });
        return chain;
      });

      const result = await service.getStats('user-1');

      expect(result.messages_sent).toBe(0);
      expect(result.corrections_count).toBe(0);
      expect(result.moments_count).toBe(0);
      expect(result.study_hours.every((stat) => stat.hours === 0)).toBe(true);
    });

    it('aggregates study hours by UTC day and ignores corrupt durations', async () => {
      const callLogs = [
        { duration_seconds: 7200, started_at: '2026-08-24T10:00:00.000Z' },
        { duration_seconds: 900, started_at: '2026-08-24T18:00:00.000Z' },
        { duration_seconds: 3600, started_at: '2026-08-25T01:00:00.000Z' },
        { duration_seconds: -10, started_at: '2026-08-25T02:00:00.000Z' },
        { duration_seconds: 3600, started_at: 'not-a-date' },
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

      expect(result.study_hours.find(({ day }) => day === 'Mon')?.hours).toBe(
        2.3,
      );
      expect(result.study_hours.find(({ day }) => day === 'Tue')?.hours).toBe(
        1,
      );
    });

    it('caps an individual corrupt call duration at 24 hours', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setResolveData({
            data: [
              {
                duration_seconds: 100 * 60 * 60,
                started_at: '2026-08-24T10:00:00.000Z',
              },
            ],
            error: null,
          });
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      const result = await service.getStats('user-1');

      expect(result.study_hours.find(({ day }) => day === 'Mon')?.hours).toBe(
        24,
      );
    });

    it('fails with a stable message when a query promise rejects', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'call_logs') {
          chain._setRejectError(new Error('secret database connection detail'));
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      await expect(service.getStats('user-1')).rejects.toThrow(
        'Stats are temporarily unavailable',
      );
    });

    it('does not expose provider error messages', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'chat_messages') {
          chain._setResolveData({
            data: null,
            count: null,
            error: {
              code: 'PGRST123',
              message: 'private database provider detail',
            },
          });
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      await expect(service.getStats('user-1')).rejects.toThrow(
        'Stats are temporarily unavailable',
      );
      await expect(service.getStats('user-1')).rejects.not.toThrow(
        'private database provider detail',
      );
    });

    it('fails closed on malformed activity counts', async () => {
      supabaseMock.from.mockImplementation((table: string) => {
        const chain = createQueryChain();
        if (table === 'chat_messages') {
          chain._setResolveData({ data: null, count: -1, error: null });
        } else {
          chain._setResolveData({ data: [], count: 0, error: null });
        }
        return chain;
      });

      await expect(service.getStats('user-1')).rejects.toThrow(
        'Stats are temporarily unavailable',
      );
    });
  });
});
