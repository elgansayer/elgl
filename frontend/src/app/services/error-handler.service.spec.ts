import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { GlobalErrorHandler } from './error-handler.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('mock-token') },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('is registered as an Angular ErrorHandler implementation', () => {
    expect(handler).toBeDefined();
    expect(TestBed.inject(ErrorHandler)).toBeInstanceOf(GlobalErrorHandler);
  });

  it('reports Error instances with bounded parsed stack frames', () => {
    const stack = [
      'TypeError: Test type error',
      ...Array.from(
        { length: 25 },
        (_, index) => `    at fn${index} (test-${index}.ts:${index + 1}:10)`,
      ),
    ].join('\n');
    const error = new TypeError('Test type error');
    Object.defineProperty(error, 'stack', { value: stack });

    expect(() => handler.handleError(error)).not.toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        message: 'Test type error',
        name: 'TypeError',
        stack: expect.stringContaining('test-0.ts:1:10') as unknown,
        timestamp: expect.any(String) as unknown,
      }),
    );
    expect((req.request.body as { stackFrames: unknown[] }).stackFrames).toHaveLength(20);
    req.flush({ status: 'logged' });
  });

  it('redacts credential-shaped data before it leaves the browser', () => {
    const error = new Error(
      'request failed with Bearer secret-token and access_token=private-value',
    );
    Object.defineProperty(error, 'stack', {
      value:
        'Error: eyJabcdefghijk.abcdefghijk.abcdefghijk\n    at load (https://example.com/app.js?api_key=secret:42:1)',
    });

    handler.handleError(error);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as {
      message: string;
      stack: string;
    };
    expect(body.message).toContain('Bearer [redacted]');
    expect(body.message).toContain('access_token=[redacted]');
    expect(body.message).not.toContain('secret-token');
    expect(body.stack).toContain('[redacted-jwt]');
    expect(body.stack).not.toContain('eyJabcdefghijk.abcdefghijk.abcdefghijk');
    req.flush({ status: 'logged' });
  });

  it('unwraps promise-style rejection errors without serialising wrapper objects', () => {
    handler.handleError({ rejection: new RangeError('wrapped failure') });

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        message: 'wrapped failure',
        name: 'RangeError',
      }),
    );
    req.flush({ status: 'logged' });
  });

  it('reports HttpErrorResponse using safe scalar metadata and does not rethrow', () => {
    const error = new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      url: 'https://api.example.com/private?access_token=secret#fragment',
    });

    expect(() => handler.handleError(error)).not.toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        name: 'HttpError',
        url: 'https://api.example.com/private',
        metadata: { status: 503, statusText: 'Service Unavailable' },
      }),
    );
    req.flush({ status: 'logged' });
  });

  it('does not inspect arbitrary object properties or throw from unknown values', () => {
    const value = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(value, 'message', {
      get: () => {
        throw new Error('getter should not run');
      },
    });

    expect(() => handler.handleError(value)).not.toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        message: 'Unknown client throwable',
        name: 'UnknownThrowable',
        metadata: { rawType: 'object' },
      }),
    );
    req.flush({ status: 'logged' });
  });

  it('deduplicates identical crash bursts', () => {
    handler.handleError(new Error('same failure'));
    handler.handleError(new Error('same failure'));

    const requests = httpTesting.match('/api/analytics/client-error');
    expect(requests).toHaveLength(1);
    requests[0]?.flush({ status: 'logged' });
  });

  it('caps reporting volume to ten crashes per minute', () => {
    for (let index = 0; index < 12; index += 1) {
      handler.handleError(new Error(`failure-${index}`));
    }

    const requests = httpTesting.match('/api/analytics/client-error');
    expect(requests).toHaveLength(10);
    for (const request of requests) request.flush({ status: 'logged' });
  });

  it('swallows reporting failures so telemetry cannot recurse into another crash', () => {
    expect(() => handler.handleError(new Error('network failure'))).not.toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush('Server error', {
      status: 500,
      statusText: 'Internal Server Error',
    });
  });
});
