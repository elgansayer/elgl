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

  it('should include parsed stackFrames when a stack trace is available', () => {
    const testError = new Error('Parsed');
    Object.defineProperty(testError, 'stack', {
      value: 'Error: Parsed\n    at foo (test.ts:42:10)\n    at bar (other.ts:5:3)',
    });

    handler.handleError(testError);

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    const frames = body['stackFrames'] as Array<Record<string, unknown>>;
    expect(frames).toHaveLength(2);
    expect(frames[0]).toEqual(
      expect.objectContaining({
        functionName: 'foo',
        fileName: 'test.ts',
        lineNumber: 42,
        columnNumber: 10,
      }),
    );
    expect(frames[1]).toEqual(
      expect.objectContaining({
        functionName: 'bar',
        fileName: 'other.ts',
        lineNumber: 5,
        columnNumber: 3,
      }),
    );
    req.flush({ status: 'logged' });
  });

  it('should report string errors as UncaughtString', () => {
    handler.handleError('Unhandled promise rejection');

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Unhandled promise rejection');
    expect(body['name']).toBe('UncaughtString');
    req.flush({ status: 'logged' });
  });

  it('should rethrow HttpErrorResponse to preserve Angular default behaviour', () => {
    const httpError = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

    expect(() => handler.handleError(httpError)).toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush({ status: 'logged' });
  });

  it('should report HttpErrorResponse details to analytics', () => {
    const httpError = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
      url: 'https://api.example.com/missing',
    });

    expect(() => handler.handleError(httpError)).toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    expect(body['name']).toBe('HttpError');
    expect(body['message']).toContain('404');
    expect(body['metadata']).toEqual({ status: 404, statusText: 'Not Found' });
    req.flush({ status: 'logged' });
  });

  it('should report unknown objects as UnknownThrowable', () => {
    const plainObj = { message: 'custom throw', code: 42 };

    expect(() => handler.handleError(plainObj)).toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    const body = req.request.body as Record<string, unknown>;
    expect(body['name']).toBe('UnknownThrowable');
    expect(body['message']).toBe('custom throw');
    expect(body['metadata']).toEqual(expect.objectContaining({ rawType: 'Object' }));
    req.flush({ status: 'logged' });
  });

  it('should rethrow non-Error, non-HttpErrorResponse objects', () => {
    const customErr = { message: 'Boom' };
    expect(() => handler.handleError(customErr)).toThrow();

    const req = httpTesting.expectOne('/api/analytics/client-error');
    req.flush({ status: 'logged' });
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