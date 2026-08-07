import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerState } from './interfaces/escrow-transaction.interface';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 3,
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly breakers = new Map<string, CircuitBreakerState>();
  private readonly halfOpenAttempts = new Map<string, number>();
  private readonly config: CircuitBreakerConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
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

  getState(service: string): CircuitBreakerState {
    return this.getBreaker(service);
  }

  reset(service: string): void {
    this.breakers.delete(service);
    this.halfOpenAttempts.delete(service);
    this.logger.log(`Circuit ${service}: manually reset`);
  }

  getAllStates(): Map<string, CircuitBreakerState> {
    return new Map(this.breakers);
  }

  /**
   * Wraps an async operation with circuit breaker protection.
   * If the circuit is open, it skips the operation and returns the fallback result.
   */
  async executeWithBreaker<T>(
    service: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
    degradedMarker?: { degraded: boolean; reason?: string },
  ): Promise<T> {
    if (!this.isAvailable(service)) {
      this.logger.warn(`Circuit ${service}: open, using fallback`);
      if (degradedMarker) {
        degradedMarker.degraded = true;
        degradedMarker.reason = `Circuit breaker open for ${service}`;
      }
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
      if (degradedMarker) {
        degradedMarker.degraded = true;
        degradedMarker.reason = `Service ${service} failed: ${message}`;
      }
      return await fallback();
    }
  }
}
