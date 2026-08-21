import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { retry, timer } from 'rxjs';

/**
 * Exponential backoff configuration for HTTP 429 (Too Many Requests) retries.
 */
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Functional HTTP interceptor that retries failed requests with
 * exponential backoff + jitter when the server responds with HTTP 429.
 *
 * Delay formula: min(BASE_DELAY * 2^attempt + random(0, 500), 30_000)
 *
 * Respects the `Retry-After` header when present (seconds or HTTP-date).
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error: unknown, retryCount: number) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 429) {
          throw error;
        }

        const retryAfterSeconds = parseRetryAfterHeader(error);
        const backoffMs = Math.min(
          BASE_DELAY_MS * Math.pow(2, retryCount) + randomJitter(500),
          30_000,
        );

        const delayMs = retryAfterSeconds !== null
          ? Math.max(retryAfterSeconds * 1000, backoffMs)
          : backoffMs;

        return timer(delayMs);
      },
    }),
  );
};

function parseRetryAfterHeader(error: HttpErrorResponse): number | null {
  const header = error.headers.get('Retry-After');
  if (!header) return null;

  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds;
  }

  const parsed = Date.parse(header);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, Math.ceil((parsed - Date.now()) / 1000));
  }

  return null;
}

function randomJitter(max: number): number {
  return Math.floor(Math.random() * (max + 1));
}