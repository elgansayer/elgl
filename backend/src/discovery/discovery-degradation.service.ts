import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DegradationMarker {
  degraded: boolean;
  reason?: string;
  fallbackSource?: 'mock' | 'cache' | 'basic_query' | 'none';
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  cooldownUntil: number;
  totalFailures: number;
  totalSuccesses: number;
}

interface BreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_BREAKER_CONFIG: BreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 3,
};

@Injectable()
export class DiscoveryDegradationService {
  private readonly logger = new Logger(DiscoveryDegradationService.name);
  private readonly breakers = new Map<string, CircuitBreakerState>();
  private readonly halfOpenAttempts = new Map<string, number>();
  private readonly config: BreakerConfig;

  private readonly DEGRADATION_REDIS_KEY = 'discovery:degradation_events';
  private readonly MAX_DEGRADATION_LOG_SIZE = 500;

  constructor(private readonly supabaseService: SupabaseService) {
    this.config = { ...DEFAULT_BREAKER_CONFIG };
  }

  private getBreaker(service: string): CircuitBreakerState {
    if (!this.breakers.has(service)) {
      this.breakers.set(service, {
        isOpen: false,
        failureCount: 0,
        lastFailure: 0,
        cooldownUntil: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      });
    }
    return this.breakers.get(service)!;
  }

  /**
   * Checks if the circuit breaker for a service allows requests through.
   * Returns true if the circuit is closed or in half-open probation.
   */
  isAvailable(service: string): boolean {
    const breaker = this.getBreaker(service);

    if (!breaker.isOpen) {
      return true;
    }

    if (Date.now() > breaker.cooldownUntil) {
      const attempts = this.halfOpenAttempts.get(service) || 0;
      if (attempts < this.config.halfOpenMaxAttempts) {
        this.halfOpenAttempts.set(service, attempts + 1);
        this.logger.warn(
          `Circuit ${service}: half-open, attempt ${attempts + 1}/${this.config.halfOpenMaxAttempts}`,
        );
        return true;
      }
      this.logger.warn(
        `Circuit ${service}: half-open max attempts reached, cooling down again`,
      );
      breaker.cooldownUntil = Date.now() + this.config.cooldownMs * 2;
      this.halfOpenAttempts.set(service, 0);
    }

    return false;
  }

  /**
   * Records a successful operation, closing an open circuit if it was in recovery.
   */
  recordSuccess(service: string): void {
    const breaker = this.getBreaker(service);
    breaker.totalSuccesses += 1;

    if (breaker.isOpen) {
      this.logger.log(`Circuit ${service}: recovered, closing circuit`);
      breaker.isOpen = false;
      breaker.failureCount = 0;
      this.halfOpenAttempts.delete(service);
      return;
    }

    breaker.failureCount = 0;
  }

  /**
   * Records a failed operation, possibly tripping the circuit breaker.
   */
  recordFailure(service: string): void {
    const breaker = this.getBreaker(service);
    breaker.failureCount += 1;
    breaker.totalFailures += 1;
    breaker.lastFailure = Date.now();

    if (
      breaker.failureCount >= this.config.failureThreshold &&
      !breaker.isOpen
    ) {
      breaker.isOpen = true;
      breaker.cooldownUntil = Date.now() + this.config.cooldownMs;
      this.logger.error(
        `Circuit ${service}: OPEN after ${breaker.failureCount} failures, cooldown until ${new Date(breaker.cooldownUntil).toISOString()}`,
      );
    }
  }

  /**
   * Executes an operation with circuit breaker protection.
   * If the circuit is open or the operation fails, the fallback is used
   * and the degradation marker is populated.
   */
  async executeWithBreaker<T>(
    service: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
    marker: DegradationMarker,
  ): Promise<T> {
    if (!this.isAvailable(service)) {
      this.logger.warn(`Circuit ${service}: open, using fallback`);
      marker.degraded = true;
      marker.reason = `Circuit breaker open for ${service}`;
      marker.fallbackSource = 'cache';
      return await fallback();
    }

    try {
      const result = await operation();
      this.recordSuccess(service);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Circuit ${service}: operation failed: ${message}`);
      this.recordFailure(service);
      marker.degraded = true;
      marker.reason = `Service ${service} failed: ${message}`;
      marker.fallbackSource = 'basic_query';
      return await fallback();
    }
  }

  /**
   * Wraps an operation with graceful degradation, using cascading fallbacks:
   * 1. Try the primary operation with circuit breaker
   * 2. If primary circuit is open or fails, try a secondary fallback directly
   * 3. If secondary also fails or returns empty, use the ultimate fallback (mock)
   */
  async executeWithCascade<T>(
    service: string,
    primary: () => Promise<T>,
    secondary: () => Promise<T>,
    ultimateFallback: () => Promise<T> | T,
  ): Promise<{ data: T; marker: DegradationMarker }> {
    // Check circuit breaker first
    if (!this.isAvailable(service)) {
      this.logger.warn(`Circuit ${service}: open, cascading to secondary`);

      try {
        const secondaryResult = await secondary();
        if (
          Array.isArray(secondaryResult) &&
          (secondaryResult as unknown[]).length > 0
        ) {
          return {
            data: secondaryResult,
            marker: {
              degraded: true,
              reason: `Circuit breaker open for ${service}`,
              fallbackSource: 'basic_query',
            },
          };
        }
      } catch {
        // Fall through to ultimate
      }

      const ultimateResult = await ultimateFallback();
      return {
        data: ultimateResult,
        marker: {
          degraded: true,
          reason: `Circuit breaker open for ${service}; secondary also failed`,
          fallbackSource: 'mock',
        },
      };
    }

    // Try primary
    try {
      const primaryResult = await primary();
      this.recordSuccess(service);

      if (
        Array.isArray(primaryResult) &&
        (primaryResult as unknown[]).length === 0
      ) {
        this.logger.warn(
          `Primary query for ${service} returned empty, cascading`,
        );

        try {
          const secondaryResult = await secondary();
          if (
            Array.isArray(secondaryResult) &&
            (secondaryResult as unknown[]).length > 0
          ) {
            return {
              data: secondaryResult,
              marker: {
                degraded: true,
                reason: 'Primary query returned empty',
                fallbackSource: 'basic_query',
              },
            };
          }
        } catch {
          // Fall through to ultimate
        }

        const ultimateResult = await ultimateFallback();
        return {
          data: ultimateResult,
          marker: {
            degraded: true,
            reason: 'Primary query returned empty; secondary also failed',
            fallbackSource: 'mock',
          },
        };
      }

      return {
        data: primaryResult,
        marker: { degraded: false, fallbackSource: 'none' },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Circuit ${service}: operation failed: ${message}`);
      this.recordFailure(service);

      // Try secondary
      try {
        const secondaryResult = await secondary();
        if (
          Array.isArray(secondaryResult) &&
          (secondaryResult as unknown[]).length > 0
        ) {
          return {
            data: secondaryResult,
            marker: {
              degraded: true,
              reason: `Primary failed: ${message}`,
              fallbackSource: 'basic_query',
            },
          };
        }
      } catch {
        // Fall through to ultimate
      }

      const ultimateResult = await ultimateFallback();
      return {
        data: ultimateResult,
        marker: {
          degraded: true,
          reason: `Primary failed: ${message}; secondary also failed`,
          fallbackSource: 'mock',
        },
      };
    }
  }

  /**
   * Records a degradation event to Redis for monitoring/alerting.
   */
  async recordDegradationEvent(
    endpoint: string,
    reason: string,
    fallbackSource: string,
    userId?: string,
  ): Promise<void> {
    try {
      const redis = this.supabaseService.getRedisClient();
      const event = JSON.stringify({
        endpoint,
        reason,
        fallbackSource,
        userId: userId ?? 'anonymous',
        timestamp: new Date().toISOString(),
      });

      await redis.lpush(this.DEGRADATION_REDIS_KEY, event);
      await redis.ltrim(
        this.DEGRADATION_REDIS_KEY,
        0,
        this.MAX_DEGRADATION_LOG_SIZE - 1,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to record degradation event: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieves recent degradation events for monitoring.
   */
  async getRecentDegradationEvents(
    limit: number = 50,
  ): Promise<Record<string, unknown>[]> {
    try {
      const redis = this.supabaseService.getRedisClient();
      const items = await redis.lrange(
        this.DEGRADATION_REDIS_KEY,
        0,
        limit - 1,
      );
      return items.map(
        (item: string) => JSON.parse(item) as Record<string, unknown>,
      );
    } catch {
      return [];
    }
  }

  /**
   * Resets all circuit breakers (useful for testing / admin intervention).
   */
  resetAllBreakers(): void {
    this.breakers.clear();
    this.halfOpenAttempts.clear();
    this.logger.log('All discovery circuit breakers reset');
  }

  /**
   * Returns the current state of all circuit breakers for monitoring.
   */
  getAllBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.breakers);
  }
}
