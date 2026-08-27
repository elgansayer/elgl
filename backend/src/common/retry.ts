import { PinoLogger } from 'nestjs-pino';

/**
 * Default retry options for exponential backoff.
 * Targets HTTP 429 (Too Many Requests) from Supabase PostgREST API.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 500). */
  baseDelayMs?: number;
  /** Optional logger for recording retry attempts. */
  logger?: PinoLogger;
}

/**
 * Determines whether a Supabase PostgREST error is an HTTP 429 (Too Many Requests).
 * PostgREST returns 429 with code '429' in the error object.
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  // PostgREST returns code '429' for rate-limited requests
  if (err.code === '429') return true;
  // Also check for HTTP status in the error
  if (err.status === 429) return true;
  // Check nested statusCode
  if (err.statusCode === 429) return true;
  // Check for standard HTTP 429 status text in message
  if (
    typeof err.message === 'string' &&
    (err.message.toLowerCase().includes('429') ||
      err.message.toLowerCase().includes('too many requests'))
  ) {
    return true;
  }
  return false;
}

/**
 * Wraps an async operation with exponential backoff retry logic for HTTP 429 errors.
 *
 * @param operation - The async function to execute with retry logic.
 * @param options - Retry configuration options.
 * @returns The result of the operation.
 * @throws The original error if all retry attempts are exhausted.
 */
export async function withRetry<T>(
  operation: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500, logger } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      // If we previously had errors and this succeeded after a retry, log it
      if (attempt > 0 && logger) {
        logger.info(
          { attempt, totalAttempts: attempt + 1 },
          'Retry succeeded for Supabase operation',
        );
      }
      return result;
    } catch (error: unknown) {
      lastError = error;

      // If not a rate-limit error or this was the last attempt, throw immediately
      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter: delay = baseDelay * 2^attempt + random jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * (baseDelayMs * 0.5);
      const delay = exponentialDelay + jitter;

      if (logger) {
        logger.warn(
          {
            attempt: attempt + 1,
            maxRetries,
            delayMs: Math.round(delay),
            error: error instanceof Error ? error.message : String(error),
          },
          'HTTP 429 rate limit hit, retrying with exponential backoff',
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}
