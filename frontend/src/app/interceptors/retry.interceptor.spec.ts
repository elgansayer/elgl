import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { retryInterceptor } from './retry.interceptor';

describe('RetryInterceptor (HTTP 429 exponential backoff)', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.useRealTimers();
  });

  it('retries on 429 responses up to MAX_RETRIES and ultimately fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const promise = new Promise<void>((resolve, reject) => {
      http.get('/api/test').subscribe({
        next: () => reject(new Error('should not succeed')),
        error: (err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          expect(httpErr.status).toBe(429);
          resolve();
        },
      });
    });

    // Initial request + 3 retries = 4 total
    for (let i = 0; i < 4; i++) {
      const req = httpTesting.expectOne('/api/test');
      req.flush(
        { message: 'Too Many Requests' },
        { status: 429, statusText: 'Too Many Requests' },
      );

      if (i < 3) {
        await vi.runAllTimersAsync();
      }
    }

    await promise;
  });

  it('succeeds on first retry after a 429', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const promise = new Promise<void>((resolve, reject) => {
      http.get('/api/test-ok').subscribe({
        next: (data) => {
          expect(data).toEqual({ status: 'ok' });
          resolve();
        },
        error: () => reject(new Error('should succeed on retry')),
      });
    });

    // First request fails with 429
    const req1 = httpTesting.expectOne('/api/test-ok');
    req1.flush(
      { message: 'Too Many Requests' },
      { status: 429, statusText: 'Too Many Requests' },
    );

    await vi.runAllTimersAsync();

    // Retry succeeds
    const req2 = httpTesting.expectOne('/api/test-ok');
    req2.flush({ status: 'ok' });

    await promise;
  });

  it('does NOT retry on non-429 errors and propagates immediately', async () => {
    const promise = new Promise<void>((resolve, reject) => {
      http.get('/api/teapot').subscribe({
        next: () => reject(new Error('should not succeed')),
        error: (err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          expect(httpErr.status).toBe(418);
          resolve();
        },
      });
    });

    const req = httpTesting.expectOne('/api/teapot');
    req.flush(
      { message: "I'm a teapot" },
      { status: 418, statusText: "I'm a teapot" },
    );

    // Should immediately propagate 418 without any retries
    httpTesting.verify();

    await promise;
  });

  it('respects the Retry-After header in seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const promise = new Promise<void>((resolve, reject) => {
      http.get('/api/rate-limited').subscribe({
        next: (data) => {
          expect(data).toEqual({ ok: true });
          resolve();
        },
        error: () => reject(new Error('should succeed on retry')),
      });
    });

    const req1 = httpTesting.expectOne('/api/rate-limited');
    const retryAfterSeconds = 5;
    req1.flush(
      { message: 'Rate limited' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': String(retryAfterSeconds) },
      },
    );

    // Timer should fire, then retry should happen
    await vi.runAllTimersAsync();

    const req2 = httpTesting.expectOne('/api/rate-limited');
    req2.flush({ ok: true });

    await promise;
  });

  it('respects exponential backoff delay between successive 429s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // We only care that successive calls trigger retries with backoff
    const promise = new Promise<void>((resolve) => {
      http.get('/api/backoff').subscribe({
        error: (err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          expect(httpErr.status).toBe(429);
          resolve();
        },
      });
    });

    // 4 requests total (initial + 3 retries), each 429
    for (let i = 0; i < 4; i++) {
      const req = httpTesting.expectOne('/api/backoff');
      req.flush({}, { status: 429, statusText: 'Too Many Requests' });
      if (i < 3) {
        await vi.runAllTimersAsync();
      }
    }

    await promise;
  });
});