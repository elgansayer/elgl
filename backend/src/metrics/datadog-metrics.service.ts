import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StatsD as StatsDClient } from 'hot-shots';
import StatsD from 'hot-shots';

@Injectable()
export class DatadogMetricsService implements OnModuleDestroy {
  private readonly logger = new Logger(DatadogMetricsService.name);
  private readonly client: StatsDClient | null = null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('DD_AGENT_HOST');
    const port = this.configService.get<number>('DD_DOGSTATSD_PORT');
    const apiKey = this.configService.get<string>('DD_API_KEY');

    this.enabled = !!(host && port && apiKey);

    if (this.enabled) {
      this.client = new StatsD({
        host,
        port: Number(port),
        prefix: 'hellotalk.',
        globalTags: {
          service: 'hellotalk-api',
          env: this.configService.get<string>('DD_ENV') || 'production',
        },
        errorHandler: (err: Error) => {
          this.logger.warn(`Datadog StatsD error: ${err.message}`);
        },
      });
      this.logger.log(`Datadog metrics enabled (${host}:${port})`);
    } else {
      this.logger.warn(
        'Datadog metrics disabled: DD_AGENT_HOST, DD_DOGSTATSD_PORT, or DD_API_KEY not configured',
      );
    }
  }

  onModuleDestroy(): void {
    if (this.client) {
      this.client.close();
    }
  }

  /**
   * Increment a counter metric. For Datadog alert thresholds.
   */
  increment(stat: string, tags?: Record<string, string>, value = 1): void {
    if (!this.client) return;
    try {
      this.client.increment(stat, value, tags);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Failed to increment ${stat}: ${error.message}`);
    }
  }

  /**
   * Record a gauge value (point-in-time metric).
   */
  gauge(stat: string, value: number, tags?: Record<string, string>): void {
    if (!this.client) return;
    try {
      this.client.gauge(stat, value, tags);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Failed to gauge ${stat}: ${error.message}`);
    }
  }

  /**
   * Record a histogram / timing value in milliseconds.
   */
  timing(
    stat: string,
    durationMs: number,
    tags?: Record<string, string>,
  ): void {
    if (!this.client) return;
    try {
      this.client.timing(stat, durationMs, tags);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Failed to timing ${stat}: ${error.message}`);
    }
  }

  /**
   * Convenience: record an event-like datapoint with status tag.
   */
  event(
    title: string,
    text: string,
    alertType: 'info' | 'success' | 'warning' | 'error' = 'info',
    tags?: Record<string, string>,
  ): void {
    if (!this.client) return;
    try {
      const tagPairs = Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`);
      this.client.event(title, text, { alert_type: alertType }, tagPairs);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Failed to send event ${title}: ${error.message}`);
    }
  }

  /**
   * Check if datadog is configured and active.
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
