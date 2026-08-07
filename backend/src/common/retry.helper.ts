import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 32000;

const logger = new Logger('RetryHelper');

function parseRetryAfter(headers: Record<string, string>): number | null {
  const headerValue = headers['retry-after'];
  if (!headerValue) return null;

  const parsed = parseInt(headerValue, 10);
  if (!isNaN(parsed) && parsed > 0) return parsed * 1000;

  const date = Date.parse(headerValue);
  if (!isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : null;
  }

  return null;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 502;
}

export async function withRetry<T>(
  fn: () => Promise<{ data: T; status: number; headers?: Record<string, string> }>,
  options: RetryOptions = {},
): Promise<{ data: T; status: number }> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      if (!isRetryableStatus(result.status)) {
        return { data: result.data, status: result.status };
      }

      if (attempt === maxRetries) {
        lastError = new Error(
          `Request failed with status ${result.status} after ${maxRetries + 1} attempts`,
        );
        break;
      }

      const retryAfter = result.headers
        ? parseRetryAfter(result.headers)
        : null;
      const delay = Math.min(
        retryAfter ?? initialDelayMs * Math.pow(2, attempt),
        maxDelayMs,
      );

      logger.warn(
        `Request returned ${result.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      if (attempt === maxRetries) {
        lastError =
          error instanceof Error ? error : new Error('Request failed');
        break;
      }

      logger.warn(
        `Request threw error, retrying (attempt ${attempt + 1}/${maxRetries}): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt),
        maxDelayMs,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Request failed with unspecified error');
}