import { Injectable, ErrorHandler, inject } from '@angular/core';

export interface SrsCircuitState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  cooldownUntil: number;
  totalFailures: number;
  totalSuccesses: number;
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenMaxAttempts: 3,
};

@Injectable({
  providedIn: 'root',
})
export class SrsCircuitBreakerService {
  private errorHandler = inject(ErrorHandler);
  private readonly breakers = new Map<string, SrsCircuitState>();
  private readonly halfOpenAttempts = new Map<string, number>();
  private readonly config: CircuitBreakerConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  private getBreaker(service: string): SrsCircuitState {
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

    if (!breaker.isOpen) return true;

    if (Date.now() > breaker.cooldownUntil) {
      const attempts = this.halfOpenAttempts.get(service) || 0;
      if (attempts < this.config.halfOpenMaxAttempts) {
        this.halfOpenAttempts.set(service, attempts + 1);
        return true;
      }
      breaker.cooldownUntil = Date.now() + this.config.cooldownMs * 2;
      this.halfOpenAttempts.set(service, 0);
    }

    return false;
  }

  recordSuccess(service: string): void {
    const breaker = this.getBreaker(service);
    breaker.totalSuccesses += 1;

    if (breaker.isOpen) {
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

    if (breaker.failureCount >= this.config.failureThreshold && !breaker.isOpen) {
      breaker.isOpen = true;
      breaker.cooldownUntil = Date.now() + this.config.cooldownMs;
      const circuitError = new Error(
        `SRS circuit breaker OPEN for ${service} after ${breaker.failureCount} failures`,
      );
      circuitError.name = 'SrsCircuitBreakerOpen';
      this.errorHandler.handleError(circuitError);
    }
  }

  getState(service: string): SrsCircuitState {
    return { ...this.getBreaker(service) };
  }

  reset(service: string): void {
    this.breakers.delete(service);
    this.halfOpenAttempts.delete(service);
  }

  /**
   * Wraps an async operation with circuit breaker protection.
   * If the circuit is open, skips the operation and returns the fallback result.
   */
  async executeWithBreaker<T>(
    service: string,
    operation: () => Promise<T>,
    fallback: () => Promise<T> | T,
    degradedMarker?: { degraded: boolean; reason?: string },
  ): Promise<T> {
    if (!this.isAvailable(service)) {
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
      this.recordFailure(service);
      if (degradedMarker) {
        degradedMarker.degraded = true;
        degradedMarker.reason = `Service ${service} failed: ${message}`;
      }
      return await fallback();
    }
  }
}
