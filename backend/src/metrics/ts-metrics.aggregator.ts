import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates Trust & Safety stats from the database and pushes them to
 * Prometheus gauges on a regular schedule, enabling Datadog monitors
 * and Grafana dashboards to track T&S health without direct DB queries
 * on each scrape.
 */
@Injectable()
export class TrustSafetyMetricsAggregator {
  constructor(
    @InjectPinoLogger(TrustSafetyMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectTsStats(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // --- Pending reports gauge ---
      const { count: pendingCount } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      this.metricsService.setTsPendingReports(pendingCount ?? 0);

      // --- Pending reports by category ---
      const categories = [
        'harassment',
        'spam',
        'inappropriate_content',
        'fake_profile',
        'other',
      ];
      for (const category of categories) {
        const { count: catCount } = await supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('reason_category', category);
        // Report the per-category pending breakdown as a derived log to aid alert triage
        if (catCount && catCount > 0) {
          this.logger.info(
            { category, pendingCount: catCount },
            'Pending reports by category',
          );
        }
      }

      // --- Total active blocks gauge ---
      const { count: blocksCount } = await supabase
        .from('blocks')
        .select('id', { count: 'exact', head: true });
      this.metricsService.setTsActiveBlocksTotal(blocksCount ?? 0);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate Trust & Safety metrics',
      );
    }
  }
}