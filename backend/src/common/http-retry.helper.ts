/** Minimal logger interface for retry operations. Compatible with both NestJS Logger and PinoLogger. */
export interface RetryLogger {
  warn(message: string): void;
  debug(message: string): void;
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelayMs?: number;
  /** Maximum total delay across all retries in milliseconds (default: 60000) */
  maxTotalDelayMs?: number;
  /** Optional logger instance for debug output */
  logger?: RetryLogger;
}

/**
 * Executes an async operation with exponential backoff when HTTP 429
 * (Too Many Requests) is encountered. Non-429 errors are thrown immediately
 * without retry.
 *
 * The backoff formula is: min(baseDelay * 2^attempt + jitter, 30000)
 * where jitter is ±25% of the exponential delay.
 */
export async function withExponentialBackoff<T>(
  operation: () => T | PromiseLike<T>,
  operationName: string,
  options: RetryOptions = {},
): Promise<Awaited<T>> {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxTotalDelayMs = 60_000,
    logger,
  } = options;

  let attempt = 0;
  let totalDelay = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      if (!isHttp429Error(error)) {
        throw error;
      }

      attempt++;
      if (attempt > maxRetries) {
        logger?.warn(
          `${operationName}: exhausted ${maxRetries} retries (HTTP 429)`,
        );
        throw error;
      }

      const exponentialDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        30_000,
      );
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.max(0, Math.round(exponentialDelay + jitter));

      totalDelay += delay;
      if (totalDelay > maxTotalDelayMs) {
        logger?.warn(
          `${operationName}: total backoff delay exceeded ${maxTotalDelayMs}ms (HTTP 429)`,
        );
        throw error;
      }

      logger?.debug(
        `${operationName}: HTTP 429 received, retry ${attempt}/${maxRetries} after ${delay}ms`,
      );

      await sleep(delay);
    }
  }
}

function isHttp429Error(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, unknown>;

  // @nestjs/axios / AxiosError
  if (err.response && typeof err.response === 'object') {
    const response = err.response as Record<string, unknown>;
    if (response.status === 429) {
      return true;
    }
  }

  // Plain HTTP error with status field
  if (err.status === 429) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
