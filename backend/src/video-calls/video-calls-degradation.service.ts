import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface DegradationMarker {
  degraded: boolean;
  reason?: string;
  fallbackSource?: 'livekit' | 'cache' | 'standalone' | 'none';
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
  failureThreshold: 3,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 2,
};

@Injectable()
export class VideoCallsDegradationService {
  private readonly logger = new Logger(VideoCallsDegradationService.name);
  private readonly breakers = new Map<string, CircuitBreakerState>();
  private readonly halfOpenAttempts = new Map<string, number>();
  private readonly config: BreakerConfig;

  private readonly DEGRADATION_REDIS_KEY = 'video-calls:degradation_events';
  private readonly MAX_DEGRADATION_LOG_SIZE = 500;

  /** In-memory fallback cache for recent room tokens (LRU approximation) */
  private readonly tokenCache = new Map<
    string,
    { token: string; expiresAt: number }
  >();
  private readonly MAX_TOKEN_CACHE_SIZE = 100;
  private readonly TOKEN_CACHE_TTL_MS = 3_600_000; // 1 hour

  constructor(private readonly supabaseService: SupabaseService) {
    this.config = { ...DEFAULT_BREAKER_CONFIG };
  }

  // ----- Circuit Breaker -----

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

  // ----- Token Cache (fallback when LiveKit is unavailable) -----

  /**
   * Caches a room token for fallback use when LiveKit is degraded.
   * Tokens are short-lived but can serve as a best-effort fallback.
   */
  cacheToken(roomName: string, userId: string, token: string): void {
    const key = `${roomName}:${userId}`;
    this.tokenCache.set(key, {
      token,
      expiresAt: Date.now() + this.TOKEN_CACHE_TTL_MS,
    });

    // LRU eviction: remove oldest entries when cache exceeds limit
    if (this.tokenCache.size > this.MAX_TOKEN_CACHE_SIZE) {
      const oldestKey = this.tokenCache.keys().next().value;
      if (oldestKey) {
        this.tokenCache.delete(oldestKey);
      }
    }
  }

  /**
   * Retrieves a cached token if available and not expired.
   * Returns null if no valid cached token exists.
   */
  getCachedToken(roomName: string, userId: string): string | null {
    const key = `${roomName}:${userId}`;
    const entry = this.tokenCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.tokenCache.delete(key);
      return null;
    }
    return entry.token;
  }

  // ----- Degradation-aware execution -----

  /**
   * Executes an operation with circuit breaker protection for LiveKit.
   * Falls back to cached token if available, then to a standalone mode
   * indicator if all else fails.
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
      marker.fallbackSource = 'standalone';
      return await fallback();
    }
  }

  // ----- Degradation event logging -----

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

  resetAllBreakers(): void {
    this.breakers.clear();
    this.halfOpenAttempts.clear();
    this.tokenCache.clear();
    this.logger.log('All video-calls circuit breakers reset');
  }

  getAllBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.breakers);
  }
}
