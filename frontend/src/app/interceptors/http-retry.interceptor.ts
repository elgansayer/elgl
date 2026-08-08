import {
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { retry, timer } from 'rxjs';

/** Maximum number of retries when a request receives HTTP 429. */
const MAX_RETRIES = 3;

/** Base delay in milliseconds before the first retry (doubles each attempt). */
const BASE_DELAY_MS = 1000;

/**
 * Returns a random jitter between 0 and the given duration, in milliseconds.
 * This spreads concurrent retries so they don't all collide on the next
 * rate-limit window.
 */
function jitter(delayMs: number): number {
  return Math.random() * delayMs;
}

/**
 * Functional HTTP interceptor that retries requests only when the backend
 * responds with HTTP 429 (Too Many Requests) using exponential back-off
 * with full jitter.
 *
 * Retry schedule (with jitter applied on top):
 *   Attempt 1 - 1 s
 *   Attempt 2 - 2 s
 *   Attempt 3 - 4 s
 *
 * After the maximum number of retries the error is re-thrown to the caller.
 */
export const httpRetryInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (error, retryCount) => {
        if (error && error.status === 429) {
          const delayMs =
            BASE_DELAY_MS * Math.pow(2, retryCount - 1) +
            jitter(BASE_DELAY_MS);
          return timer(delayMs);
        }

        throw error;
      },
    }),
  );
};