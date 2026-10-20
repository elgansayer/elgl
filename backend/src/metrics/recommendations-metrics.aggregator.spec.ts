import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsMetricsAggregator } from './recommendations-metrics.aggregator';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

describe('RecommendationsMetricsAggregator', () => {
  let aggregator: RecommendationsMetricsAggregator;
  let scan: Mock;
  let setMatchmakingTierSuccessRate: Mock;
  let logger: { info: Mock; error: Mock };

  beforeEach(async () => {
    scan = vi
      .fn()
      .mockResolvedValueOnce(['7', ['recommendations:daily:user-1']])
      .mockResolvedValueOnce([
        '0',
        ['recommendations:daily:user-2', 'recommendations:daily:user-3'],
      ]);
    setMatchmakingTierSuccessRate = vi.fn();
    logger = { info: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsMetricsAggregator,
        {
          provide: SupabaseService,
          useValue: {
            getRedisClient: vi.fn().mockReturnValue({ scan }),
          },
        },
        {
          provide: MetricsService,
          useValue: { setMatchmakingTierSuccessRate },
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
