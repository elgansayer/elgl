import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates escrow payment stats from the database and pushes them to
 * prometheus gauges on a regular schedule, enabling Datadog monitors
 * and Grafana dashboards to track escrow health without direct DB
 * queries on each scrape.
 *
 * Issue #2381: Datadog monitoring alerts for Escrow Payments.
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

      // Total held escrows
      const { count: heldCount } = await supabase
        .from('escrow_transactions' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'held');
      this.metricsService.escrowTotalHeld.set(heldCount ?? 0);

      // Total coins held in escrow
      const { data: heldRows } = await supabase
        .from('escrow_transactions' as never)
        .select('amount_coins')
        .eq('status', 'held');
      const totalCoinsHeld = heldRows
        ? (heldRows as { amount_coins: number }[]).reduce(
            (sum, r) => sum + (r.amount_coins ?? 0),
            0,
          )
        : 0;
      this.metricsService.escrowTotalCoinsHeld.set(totalCoinsHeld);

      // Stale held escrows (older than 30 days)
      const staleThreshold = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { count: staleCount } = await supabase
        .from('escrow_transactions' as never)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'held')
        .lt('created_at', staleThreshold);
      this.metricsService.escrowStaleHeldCount.set(staleCount ?? 0);

      // Degraded queue size (approximate from Redis)
      try {
        const redis = this.supabaseService.getRedisClient();
        const degradedLen = await redis.llen('escrow_degraded_queue');
        this.metricsService.setEscrowDegradedQueueSize(degradedLen);
      } catch {
        // Redis might not be available; metric stays at last known value
      }
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate escrow metrics',
      );
    }
  }
}
