import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { CentrifugoService } from '../chat/centrifugo.service';
import Stripe from 'stripe';

export interface DependencyHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  latencyMs: number;
  lastChecked: string;
  message?: string;
}

export interface EconomyHealthSnapshot {
  overall: 'healthy' | 'degraded' | 'unavailable';
  timestamp: string;
  dependencies: {
    redis: DependencyHealth;
    supabase: DependencyHealth;
    stripe: DependencyHealth;
    centrifugo: DependencyHealth;
  };
  circuitBreakers: Record<string, { open: boolean; failureCount: number }>;
  degradedFeatures: string[];
  uptimeSeconds: number;
}

const HEALTH_CHECK_TIMEOUT_MS = 3_000;
const DEGRADED_LATENCY_THRESHOLD_MS = 1_000;

@Injectable()
export class CoinEconomyHealthService {
  private readonly logger = new Logger(CoinEconomyHealthService.name);
  private readonly startTime: number;
  private lastSnapshot: EconomyHealthSnapshot | null = null;
  private degradedFeatures = new Set<string>();

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly centrifugoService: CentrifugoService,
    private readonly configService: ConfigService,
  ) {
    this.startTime = Date.now();
  }

  /**
   * Marks a feature as degraded (e.g. catalogue, gift sending).
   * Degraded features still function via fallback but with reduced capability.
   */
  markFeatureDegraded(feature: string): void {
    if (!this.degradedFeatures.has(feature)) {
      this.logger.warn(
        `Economy feature "${feature}" marked as DEGRADED - fallback active`,
      );
    }
    this.degradedFeatures.add(feature);
  }

  /**
   * Clears a degraded feature marker when the dependency recovers.
   */
  clearFeatureDegradation(feature: string): void {
    if (this.degradedFeatures.has(feature)) {
      this.logger.log(
        `Economy feature "${feature}" recovered - degradation cleared`,
      );
    }
    this.degradedFeatures.delete(feature);
  }

  /**
   * Returns whether a specific feature is currently degraded.
   */
  isFeatureDegraded(feature: string): boolean {
    return this.degradedFeatures.has(feature);
  }

  /**
   * Returns a list of all currently degraded features.
   */
  getDegradedFeatures(): string[] {
    return [...this.degradedFeatures];
  }

  /**
   * Performs a health check on all economy dependencies and returns a
   * comprehensive snapshot. Each dependency check has a timeout to prevent
   * the health check itself from hanging.
   */
  async getHealthSnapshot(): Promise<EconomyHealthSnapshot> {
    const [redisHealth, supabaseHealth, stripeHealth, centrifugoHealth] =
      await Promise.all([
        this.checkRedis(),
        this.checkSupabase(),
        this.checkStripe(),
        this.checkCentrifugo(),
      ]);

    const statuses = [
      redisHealth.status,
      supabaseHealth.status,
      stripeHealth.status,
      centrifugoHealth.status,
    ];

    let overall: EconomyHealthSnapshot['overall'];
    if (statuses.some((s) => s === 'unavailable')) {
      overall = 'degraded';
    } else if (statuses.filter((s) => s === 'degraded').length >= 2) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    const snapshot: EconomyHealthSnapshot = {
      overall,
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisHealth,
        supabase: supabaseHealth,
        stripe: stripeHealth,
        centrifugo: centrifugoHealth,
      },
      circuitBreakers: {},
      degradedFeatures: this.getDegradedFeatures(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };

    this.lastSnapshot = snapshot;

    if (overall !== 'healthy') {
      this.logger.warn(
        `Economy health check result: ${overall} (degraded: ${snapshot.degradedFeatures.join(', ') || 'none'})`,
      );
    }

    return snapshot;
  }

  /**
   * Returns the last cached health snapshot without re-running checks,
   * or runs a fresh check if no snapshot exists.
   */
  async getCachedSnapshot(): Promise<EconomyHealthSnapshot> {
    if (this.lastSnapshot) return this.lastSnapshot;
    return this.getHealthSnapshot();
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const redis = this.supabaseService.getRedisClient();
      const pingStart = Date.now();
      const result = await this.withTimeout(
        redis.ping(),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      const latency = Date.now() - pingStart;

      if (result === 'PONG') {
        const status =
          latency > DEGRADED_LATENCY_THRESHOLD_MS ? 'degraded' : 'healthy';
        if (status === 'degraded') {
          this.markFeatureDegraded('redis-cache');
        } else {
          this.clearFeatureDegradation('redis-cache');
        }
        return {
          status,
          latencyMs: latency,
          lastChecked: new Date().toISOString(),
        };
      }
      this.markFeatureDegraded('redis-cache');
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        message: 'Unexpected PING response',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.markFeatureDegraded('redis-cache');
      return {
        status: 'unavailable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        message: msg,
      };
    }
  }

  private async checkSupabase(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const supabase = this.supabaseService.getClient();
      const result = await this.withTimeout(
        supabase.from('users').select('id').limit(1),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      const latency = Date.now() - start;

      if (!result.error) {
        const status =
          latency > DEGRADED_LATENCY_THRESHOLD_MS ? 'degraded' : 'healthy';
        if (status === 'degraded') {
          this.markFeatureDegraded('supabase-query');
        } else {
          this.clearFeatureDegradation('supabase-query');
        }
        return {
          status,
          latencyMs: latency,
          lastChecked: new Date().toISOString(),
        };
      }

      this.markFeatureDegraded('supabase-query');
      return {
        status: 'degraded',
        latencyMs: latency,
        lastChecked: new Date().toISOString(),
        message: result.error.message,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.markFeatureDegraded('supabase-query');
      return {
        status: 'unavailable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        message: msg,
      };
    }
  }

  private async checkStripe(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (!stripeKey) {
        return {
          status: 'unavailable',
          latencyMs: 0,
          lastChecked: new Date().toISOString(),
          message: 'STRIPE_SECRET_KEY not configured',
        };
      }
      // Lightweight check: just verify the key is valid by reading balance
      const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      await this.withTimeout(
        stripe.balance.retrieve(),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      const latency = Date.now() - start;
      const status =
        latency > DEGRADED_LATENCY_THRESHOLD_MS ? 'degraded' : 'healthy';
      if (status === 'degraded') {
        this.markFeatureDegraded('stripe-api');
      } else {
        this.clearFeatureDegradation('stripe-api');
      }
      return {
        status,
        latencyMs: latency,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.markFeatureDegraded('stripe-api');
      return {
        status: 'unavailable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        message: msg,
      };
    }
  }

  private async checkCentrifugo(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      // Centrifugo health check via publish to a health channel
      await this.withTimeout(
        this.centrifugoService.publish('health_check', {
          type: 'ping',
          timestamp: new Date().toISOString(),
        }),
        HEALTH_CHECK_TIMEOUT_MS,
      );
      const latency = Date.now() - start;
      const status =
        latency > DEGRADED_LATENCY_THRESHOLD_MS ? 'degraded' : 'healthy';
      if (status === 'degraded') {
        this.markFeatureDegraded('centrifugo-broadcast');
      } else {
        this.clearFeatureDegradation('centrifugo-broadcast');
      }
      return {
        status,
        latencyMs: latency,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.markFeatureDegraded('centrifugo-broadcast');
      return {
        status: 'unavailable',
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        message: msg,
      };
    }
  }

  private async withTimeout<T>(
    promise: PromiseLike<T>,
    ms: number,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Health check timed out after ${ms}ms`));
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      return result;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }
}
