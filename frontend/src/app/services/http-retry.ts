import { HttpErrorResponse } from '@angular/common/http';

/** Options for exponential backoff HTTP retry logic. */
export interface HttpRetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 500). */
  baseDelayMs?: number;
}

/**
 * Determines whether an error is an HTTP 429 (Too Many Requests).
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return true;
  }
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (err['status'] === 429 || err['statusCode'] === 429) return true;
  }
  return false;
}

/**
 * Wraps an async operation with exponential backoff retry logic for HTTP 429 errors.
 *
 * @param operation - The async function to execute with retry logic.
 * @param options - Retry configuration options.
 * @returns The result of the operation.
 * @throws The original error if all retry attempts are exhausted or a non-429 error occurs.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: HttpRetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 500 } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (!isRateLimitError(error) || attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter: delay = baseDelay * 2^attempt + random jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * (baseDelayMs * 0.5);
      const delay = exponentialDelay + jitter;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}