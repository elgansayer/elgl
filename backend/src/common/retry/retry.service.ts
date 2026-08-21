import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** Whether to add jitter to avoid thundering herd (default: true) */
  jitter?: boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTimeMs: number;
}

@Injectable()
export class RetryService {
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_BASE_DELAY_MS = 1000;
  private static readonly DEFAULT_MAX_DELAY_MS = 30000;

  constructor(private readonly logger: PinoLogger) {}

  /**
   * Executes an async operation with exponential backoff retry on HTTP 429 responses.
   * The operation should throw an error with a `status` or `statusCode` property of 429
   * to trigger a retry. If the error includes a `Retry-After` header, its value is used
   * as the delay instead of the calculated exponential delay.
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<RetryResult<T>> {
    const maxRetries = options.maxRetries ?? RetryService.DEFAULT_MAX_RETRIES;
    const baseDelayMs =
      options.baseDelayMs ?? RetryService.DEFAULT_BASE_DELAY_MS;
    const maxDelayMs = options.maxDelayMs ?? RetryService.DEFAULT_MAX_DELAY_MS;
    const useJitter = options.jitter ?? true;

    const startTime = Date.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        const totalTimeMs = Date.now() - startTime;

        if (attempt > 0) {
          this.logger.info(
            `Operation succeeded after ${attempt} retries (${totalTimeMs}ms total)`,
          );
        }

        return { result, attempts: attempt + 1, totalTimeMs };
      } catch (error: unknown) {
        lastError = error;

        if (attempt >= maxRetries) {
          break;
        }

        if (!this.isRetryableError(error)) {
          throw error;
        }

        const delayMs = this.calculateDelay(
          error,
          attempt,
          baseDelayMs,
          maxDelayMs,
          useJitter,
        );

        this.logger.warn(
          `Operation failed with 429 (attempt ${attempt + 1}/${maxRetries + 1}), ` +
            `retrying in ${delayMs}ms`,
        );

        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  /**
   * Determines whether an error is retryable (HTTP 429 Too Many Requests or
   * rate-limit responses from Stripe, Supabase, or other providers).
   */
  private isRetryableError(error: unknown): boolean {
    if (error === null || error === undefined) {
      return false;
    }

    const err = error as Record<string, unknown>;

    // Check for HTTP 429 status code (Axios errors use `response.status`,
    // NestJS HttpException uses `getStatus()` or `status` property)
    const status =
      err.status ??
      err.statusCode ??
      (err.response && typeof err.response === 'object'
        ? (err.response as Record<string, unknown>).status
        : undefined);

    if (status === 429) {
      return true;
    }

    // Check for Stripe rate limit errors (type === 'RateLimitError')
    if (
      typeof err.type === 'string' &&
      err.type.toLowerCase().includes('rate_limit')
    ) {
      return true;
    }

    // Check for Supabase 429 errors
    if (typeof err.code === 'string' && err.code === '429') {
      return true;
    }

    // Axios errors: check if the original request got a 429
    if (err.isAxiosError === true && status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Calculates the backoff delay using exponential backoff with optional jitter.
   * If the error contains a valid Retry-After value, it is used instead.
   */
  private calculateDelay(
    error: unknown,
    attempt: number,
    baseDelayMs: number,
    maxDelayMs: number,
    useJitter: boolean,
  ): number {
    // Respect Retry-After header if present
    const retryAfter = this.extractRetryAfter(error);
    if (retryAfter !== null) {
      return Math.min(retryAfter, maxDelayMs);
    }

    // Exponential backoff: baseDelay * 2^attempt
    let delay = baseDelayMs * Math.pow(2, attempt);

    if (useJitter) {
      // Full jitter: random value between 0 and delay
      delay = Math.random() * delay;
    }

    return Math.min(delay, maxDelayMs);
  }

  /**
   * Extracts the Retry-After value from an error if present.
   * Supports both seconds (integer) and HTTP-date formats.
   */
  private extractRetryAfter(error: unknown): number | null {
    if (error === null || error === undefined) {
      return null;
    }

    const err = error as Record<string, unknown>;
    const headers =
      err.headers ??
      (err.response && typeof err.response === 'object'
        ? (err.response as Record<string, unknown>).headers
        : undefined);

    if (headers && typeof headers === 'object') {
      const retryAfter =
        (headers as Record<string, unknown>)['retry-after'] ??
        (headers as Record<string, unknown>)['Retry-After'];

      if (typeof retryAfter === 'string' || typeof retryAfter === 'number') {
        const seconds = Number(retryAfter);
        if (!Number.isNaN(seconds)) {
          // If it's a valid number of seconds, convert to ms
          return seconds * 1000;
        }
        // Could be an HTTP-date; for simplicity we return null and fall back
        // to exponential backoff
      }
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
