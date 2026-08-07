import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GlobalErrorHandler } from './error-handler.service';
import { AuthService } from './auth.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('mock-token'),
    };

    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: ErrorHandler, useClass: GlobalErrorHandler },
        { provide: AuthService, useValue: mockAuthService },
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

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should POST error details to /api/analytics/client-error for Error instances', () => {
    const testError = new TypeError('Test type error');
    Object.defineProperty(testError, 'stack', {
      value: 'TypeError: Test type error\n    at foo (test.ts:42:10)',
    });

    handler.handleError(testError);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        message: 'Test type error',
        name: 'TypeError',
        stack: expect.stringContaining('test.ts:42:10') as unknown,
        url: expect.any(String) as unknown,
        userAgent: expect.any(String) as unknown,
        timestamp: expect.any(String) as unknown,
      }),
    );
    req.flush({ status: 'logged' });
  });

  it('should rethrow HttpErrorResponse to preserve Angular default behaviour', () => {
    const httpError = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

    expect(() => handler.handleError(httpError)).toThrow();
  });

  it('should silently handle API failures without re-throwing', () => {
    const testError = new Error('Network failure');
    handler.handleError(testError);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Second call should also succeed without throwing
    const secondError = new Error('Second error');
    handler.handleError(secondError);
    const req2 = httpTesting.expectOne('/api/analytics/client-error');
    req2.flush({ status: 'logged' });
  });

  it('should handle errors without a stack trace', () => {
    const testError = new Error('Stackless error');
    delete (testError as Partial<Error>).stack;

    handler.handleError(testError);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Stackless error');
    req.flush({ status: 'logged' });
  });
});