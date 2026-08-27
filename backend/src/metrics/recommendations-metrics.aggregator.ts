import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates matchmaking/recommendations stats from Redis and pushes
 * them to prometheus gauges on a regular schedule, enabling Datadog
 * monitors to track matchmaking health without direct DB queries
 * on each scrape.
 *
 * Issue #2280: Datadog monitoring alerts for Matchmaking Algorithm.
 */
@Injectable()
export class RecommendationsMetricsAggregator {
  constructor(
    @InjectPinoLogger(RecommendationsMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectMatchmakingStats(): Promise<void> {
    try {
      const redis = this.supabaseService.getRedisClient();

      // Count active daily recommendation cache entries (indicates
      // the daily cron ran successfully)
      const cacheKeys = await redis.keys('recommendations:daily:*');
      const tier1SuccessCount = Array.isArray(cacheKeys) ? cacheKeys.length : 0;

      // Use the tier_success_rate gauge to approximate tier-1 health:
      // when Redis daily cache is populated, tier-1 (interest) is working
      // Normalise to 0-1 range (assume healthy when >500 cached users)
      const rate = Math.min(tier1SuccessCount / 500, 1.0);
      this.metricsService.setMatchmakingTierSuccessRate(rate);

      this.logger.info(
        { cachedUsers: tier1SuccessCount, tier1SuccessRate: rate },
        'Matchmaking stats collected',
      );
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate matchmaking metrics',
      );
    }
  }
}
