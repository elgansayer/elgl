import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { httpRetryInterceptor } from './http-retry.interceptor';

describe('httpRetryInterceptor', () => {
  it('should be a function', () => {
    expect(typeof httpRetryInterceptor).toBe('function');
  });

  it('passes through a successful response immediately', (done) => {
    let receivedBody: string | undefined;

    const mockNext: HttpHandlerFn = () =>
      of(new HttpResponse<string>({ body: 'OK', status: 200 }));

    const req = new HttpRequest<unknown>('GET', '/test');

    httpRetryInterceptor(req, mockNext).subscribe({
      next: (res) => {
        if (res instanceof HttpResponse) {
          receivedBody = res.body ?? undefined;
        }
      },
      error: () => done(),
    });

    setTimeout(() => {
      expect(receivedBody).toBe('OK');
      done();
    }, 100);
  });

  it('does not retry on a non-429 error (404)', (done) => {
    let caughtError: HttpErrorResponse | undefined;
    let attempts = 0;

    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            statusText: 'Not Found',
            url: '/test',
          }),
      );
    };

    const req = new HttpRequest<unknown>('GET', '/test');

    httpRetryInterceptor(req, mockNext).subscribe({
      next: () => done(),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          caughtError = err;
        }
      },
    });

    setTimeout(() => {
      expect(caughtError).toBeTruthy();
      expect(caughtError?.status).toBe(404);
      expect(attempts).toBe(1);
      done();
    }, 500);
  });

  it('does not retry on non-HttpErrorResponse errors', (done) => {
    let caughtError: Error | undefined;
    let attempts = 0;

    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(() => new Error('Network failure'));
    };

    const req = new HttpRequest<unknown>('GET', '/test');

    httpRetryInterceptor(req, mockNext).subscribe({
      next: () => done(),
      error: (err: unknown) => {
        if (err instanceof Error) {
          caughtError = err;
        }
      },
    });

    setTimeout(() => {
      expect(caughtError).toBeTruthy();
      expect(caughtError?.message).toBe('Network failure');
      expect(attempts).toBe(1);
      done();
    }, 500);
  });

  it('retries on HTTP 429 and succeeds on a later attempt', (done) => {
    let attempt = 0;
    let successReceived = false;

    const mockNext: HttpHandlerFn = () => {
      attempt++;
      if (attempt <= 2) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 429,
              statusText: 'Too Many Requests',
              url: '/test',
            }),
        );
      }
      return of(new HttpResponse({ status: 200, body: 'OK' }));
    };

    const req = new HttpRequest<unknown>('GET', '/test');

    httpRetryInterceptor(req, mockNext).subscribe({
      next: () => {
        successReceived = true;
      },
      error: () => done(),
    });

    // With real timers the retry delay is ~1-2s; wait long enough
    setTimeout(() => {
      expect(attempt).toBe(3);
      expect(successReceived).toBe(true);
      done();
    }, 5000);
  }, 8000);

  it('exhausts retries and fails after 3 consecutive 429s', (done) => {
    let attempt = 0;
    let caughtError: HttpErrorResponse | undefined;

    const mockNext: HttpHandlerFn = () => {
      attempt++;
      return throwError(
        () =>
          new HttpErrorResponse({
            status: 429,
            statusText: 'Too Many Requests',
            url: '/test',
          }),
      );
    };

    const req = new HttpRequest<unknown>('GET', '/test');

    httpRetryInterceptor(req, mockNext).subscribe({
      next: () => done(),
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          caughtError = err;
        }
      },
    });

    // Total delay: 1+2+4 seconds ≈ 7-10s with jitter
    setTimeout(() => {
      // 1 initial + 3 retries = 4 total attempts
      expect(attempt).toBe(4);
      expect(caughtError).toBeTruthy();
      expect(caughtError?.status).toBe(429);
      done();
    }, 15000);
  }, 20000);
});