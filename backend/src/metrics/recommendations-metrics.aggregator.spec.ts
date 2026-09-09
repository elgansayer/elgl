import type { PinoLogger } from 'nestjs-pino';
import type { SupabaseService } from '../supabase/supabase.service';
import type { MetricsService } from './metrics.service';
import { RecommendationsMetricsAggregator } from './recommendations-metrics.aggregator';

describe('RecommendationsMetricsAggregator', () => {
  const scan = vi.fn();
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  };
  const supabaseService = {
    getRedisClient: vi.fn().mockReturnValue({ scan }),
  };
  const metricsService = {
    setMatchmakingTierSuccessRate: vi.fn(),
  };

  let aggregator: RecommendationsMetricsAggregator;

  beforeEach(() => {
    vi.clearAllMocks();
    aggregator = new RecommendationsMetricsAggregator(
      logger as unknown as PinoLogger,
      supabaseService as unknown as SupabaseService,
      metricsService as unknown as MetricsService,
    );
  });

  it('scans every cursor, including empty batches, and counts unique keys', async () => {
    scan
      .mockResolvedValueOnce(['17', ['recommendations:daily:user-1']])
      .mockResolvedValueOnce(['42', []])
      .mockResolvedValueOnce([
        '0',
        ['recommendations:daily:user-1', 'recommendations:daily:user-2'],
      ]);

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
      '17',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      500,
    );
    expect(scan).toHaveBeenNthCalledWith(
      3,
      '42',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      500,
    );
    expect(metricsService.setMatchmakingTierSuccessRate).toHaveBeenCalledWith(
      2 / 500,
    );
    expect(logger.info).toHaveBeenCalledWith(
      { cachedUsers: 2, tier1SuccessRate: 2 / 500 },
      'Matchmaking stats collected',
    );
  });

  it('caps the reported rate at one', async () => {
    scan.mockResolvedValueOnce([
      '0',
      Array.from(
        { length: 501 },
        (_, index) => `recommendations:daily:${index}`,
      ),
    ]);

    await aggregator.collectMatchmakingStats();

    expect(metricsService.setMatchmakingTierSuccessRate).toHaveBeenCalledWith(
      1,
    );
  });

  it('logs Redis failures without publishing a misleading rate', async () => {
    scan.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(aggregator.collectMatchmakingStats()).resolves.toBeUndefined();

    expect(metricsService.setMatchmakingTierSuccessRate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      { error: 'Redis unavailable' },
      'Failed to aggregate matchmaking metrics',
    );
  });
});
