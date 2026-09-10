import { RecommendationsMetricsAggregator } from './recommendations-metrics.aggregator';

describe('RecommendationsMetricsAggregator', () => {
  it('counts SCAN pages without retaining the complete keyspace', async () => {
    const redis = {
      scan: vi
        .fn()
        .mockResolvedValueOnce(['8', ['recommendations:daily:a']])
        .mockResolvedValueOnce([
          '0',
          ['recommendations:daily:b', 'recommendations:daily:c'],
        ]),
    };
    const metricsService = {
      setMatchmakingTierSuccessRate: vi.fn(),
    };
    const aggregator = new RecommendationsMetricsAggregator(
      { info: vi.fn(), error: vi.fn() } as never,
      { getRedisClient: vi.fn().mockReturnValue(redis) } as never,
      metricsService as never,
    );

    await aggregator.collectMatchmakingStats();

    expect(redis.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      100,
    );
    expect(redis.scan).toHaveBeenNthCalledWith(
      2,
      '8',
      'MATCH',
      'recommendations:daily:*',
      'COUNT',
      100,
    );
    expect(metricsService.setMatchmakingTierSuccessRate).toHaveBeenCalledWith(
      3 / 500,
    );
  });
});
