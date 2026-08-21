import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates moderation stats from the database and pushes them to prometheus
 * gauges on a regular schedule, enabling Datadog monitors and Grafana dashboards
 * to track moderation queue health without direct DB queries on each scrape.
 */
@Injectable()
export class ModerationMetricsAggregator {
  constructor(
    @InjectPinoLogger(ModerationMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectModerationStats(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Pending queue size
      const { count: pendingCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      this.metricsService.setModerationQueueSize(pendingCount ?? 0);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate moderation metrics',
      );
    }
  }
}
