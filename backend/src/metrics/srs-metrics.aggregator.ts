import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { SupabaseService } from '../supabase/supabase.service';
import { MetricsService } from './metrics.service';

/**
 * Aggregates SRS stats from the database and pushes them to prometheus gauges
 * on a regular schedule, enabling Datadog monitors and Grafana dashboards
 * to track SRS health without direct DB queries on each scrape.
 */
@Injectable()
export class SrsMetricsAggregator {
  constructor(
    @InjectPinoLogger(SrsMetricsAggregator.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async collectSrsStats(): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();

      // Total decks
      const { count: deckCount } = await supabase
        .from('decks')
        .select('id', { count: 'exact', head: true });
      this.metricsService.setSrsDecksTotal(deckCount ?? 0);

      // Due cards
      const { count: dueCount } = await supabase
        .from('flashcards')
        .select('id', { count: 'exact', head: true })
        .lt('srs_level', 4)
        .lte('next_review_at', new Date().toISOString());
      this.metricsService.setSrsDueCards(dueCount ?? 0);

      // Cards per SRS level
      // ⚡ Bolt Optimization: Replace sequential database queries in a loop with a concurrent Promise.all execution to improve metric aggregation performance
      const levelPromises = Array.from({ length: 5 }, async (_, level) => {
        const { count } = await supabase
          .from('flashcards')
          .select('id', { count: 'exact', head: true })
          .eq('srs_level', level);
        return { level, count };
      });
      const levelResults = await Promise.all(levelPromises);
      for (const { level, count } of levelResults) {
        this.metricsService.setSrsCardsPerLevel(level, count ?? 0);
      }

      // Average easiness factor - uses a capped sample (max 500 rows) to avoid
      // loading every flashcard row into application memory on every tick.
      // A production deployment should use a Postgres RPC or materialised view
      // for exact computation without unbounded data transfer.
      const sampleSize = 500;
      const { data: efSample } = await supabase
        .from('flashcards')
        .select('easiness_factor')
        .not('easiness_factor', 'is', null)
        .limit(sampleSize);

      if (efSample && efSample.length > 0) {
        const avgEf =
          efSample.reduce((sum, row) => sum + (row.easiness_factor ?? 2.5), 0) /
          efSample.length;
        this.metricsService.setSrsAverageEasinessFactor(
          Math.round(avgEf * 100) / 100,
        );
      }

      // Cards stuck at level 0 after 5+ repetitions (failed recall repeatedly)
      const { count: stuckCount } = await supabase
        .from('flashcards')
        .select('id', { count: 'exact', head: true })
        .eq('srs_level', 0)
        .gte('repetitions', 5);
      this.metricsService.setSrsCardsStuck(stuckCount ?? 0);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to aggregate SRS metrics',
      );
    }
  }
}
