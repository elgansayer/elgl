import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsMetricsAggregator } from './recommendations-metrics.aggregator';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

describe('RecommendationsMetricsAggregator', () => {
  let aggregator: RecommendationsMetricsAggregator;
  let scan: Mock;
  let get: Mock;
  let setMatchmakingTierSuccessRate: Mock;
  let setMatchmakingDailyJobLastCompleted: Mock;
  let logger: { info: Mock; error: Mock };

  beforeEach(async () => {
    scan = vi
      .fn()
      .mockResolvedValueOnce(['7', ['recommendations:daily:user-1']])
      .mockResolvedValueOnce([
        '0',
        ['recommendations:daily:user-2', 'recommendations:daily:user-3'],
      ]);
    get = vi.fn().mockResolvedValue(null);
    setMatchmakingTierSuccessRate = vi.fn();
    setMatchmakingDailyJobLastCompleted = vi.fn();
    logger = { info: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsMetricsAggregator,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue({ scan, get }),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            setMatchmakingTierSuccessRate,
            setMatchmakingDailyJobLastCompleted,
          },
        },
        {
          provide: 'PinoLogger:RecommendationsMetricsAggregator',
          useValue: logger,
        },
      ],
    }).compile();

    aggregator = module.get(RecommendationsMetricsAggregator);
  });

  it('counts recommendation keys across every SCAN page', async () => {
    await aggregator.collectMatchmakingStats();

    expect(scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      500,
    );
    expect(scan).toHaveBeenNthCalledWith(
      2,
      '7',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      500,
    );
    expect(setMatchmakingTierSuccessRate).toHaveBeenCalledWith(3 / 500);
  });

  it('publishes when the daily job last completed, read from Redis', async () => {
    get.mockResolvedValue('1793318400');

    await aggregator.collectMatchmakingStats();

    expect(get).toHaveBeenCalledWith(
      'jobs:recommendations:daily:last-completed',
    );
    expect(setMatchmakingDailyJobLastCompleted).toHaveBeenCalledWith(
      1793318400,
    );
  });

  it.each([null, '', '0', 'not-a-timestamp', '-5'])(
    'does not publish a completion time for the Redis value %j',
    async (stored) => {
      get.mockResolvedValue(stored);

      await aggregator.collectMatchmakingStats();

      expect(setMatchmakingDailyJobLastCompleted).not.toHaveBeenCalled();
      expect(setMatchmakingTierSuccessRate).toHaveBeenCalled();
    },
  );

  it('logs Redis errors without publishing a partial metric', async () => {
    scan.mockReset().mockRejectedValue(new Error('Redis unavailable'));

    await expect(aggregator.collectMatchmakingStats()).resolves.toBeUndefined();

    expect(setMatchmakingTierSuccessRate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'Redis unavailable' },
      'Failed to aggregate matchmaking metrics',
    );
  });
});
