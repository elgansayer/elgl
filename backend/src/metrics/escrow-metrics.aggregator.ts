import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates Escrow Payment stats from the database and pushes them to
 * prometheus gauges on a regular schedule, enabling Datadog monitors and
 * Grafana dashboards to track escrow health without direct DB queries on
 * each scrape.
 */
@Injectable()
export class EscrowMetricsAggregator {
  constructor(
    @InjectPinoLogger(EscrowMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectEscrowStats(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Count escrows per status
      const statuses = ['pending', 'released', 'refunded', 'disputed', 'cancelled'];
      for (const status of statuses) {
        const { count } = await supabase
          .from('escrows')
          .select('id', { count: 'exact', head: true })
          .eq('status', status);
        this.metricsService.setEscrowsByStatus(status, count ?? 0);
      }

      // Total value held in pending escrows
      const { data: pendingEscrows } = await supabase
        .from('escrows')
        .select('amount')
        .eq('status', 'pending');
      const valueHeld = (pendingEscrows ?? []).reduce(
        (sum, row) => sum + (row.amount ?? 0),
        0,
      );
      this.metricsService.setEscrowsValueHeld(valueHeld);

      // Escrows stuck pending > 24h
      const twentyFourHoursAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const { count: stuckCount } = await supabase
        .from('escrows')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', twentyFourHoursAgo);
      this.metricsService.setEscrowsStuckPending(stuckCount ?? 0);

      // Dispute rate
      const { count: totalDisputed } = await supabase
        .from('escrows')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'disputed');
      const { count: totalResolved } = await supabase
        .from('escrows')
        .select('id', { count: 'exact', head: true })
        .in('status', ['released', 'refunded', 'disputed']);
      if (totalResolved && totalResolved > 0) {
        const rate =
          Math.round(((totalDisputed ?? 0) / totalResolved) * 1000) / 1000;
        this.metricsService.setEscrowDisputeRate(rate);
      }
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate escrow metrics',
      );
    }
  }
}