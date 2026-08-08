import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { httpRetryInterceptor } from './http-retry.interceptor';

describe.skip('httpRetryInterceptor', () => {
  it('should be a function', () => {
    expect(typeof httpRetryInterceptor).toBe('function');
  });

  it('passes through a successful response immediately', async () => {
    const mockNext: HttpHandlerFn = () =>
      of(new HttpResponse<string>({ body: 'OK', status: 200 }));
    const req = new HttpRequest<unknown>('GET', '/test');
    
    const res = await firstValueFrom(httpRetryInterceptor(req, mockNext));
    expect((res as HttpResponse<string>).body).toBe('OK');
  });

  it('does not retry on a non-429 error (404)', async () => {
    let attempts = 0;
    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(
        () => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: '/test' })
      );
    };
    const req = new HttpRequest<unknown>('GET', '/test');
    
    try {
      await firstValueFrom(httpRetryInterceptor(req, mockNext));
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(attempts).toBe(1);
    }
  });

  it('does not retry on non-HttpErrorResponse errors', async () => {
    let attempts = 0;
    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(() => new Error('Network failure'));
    };
    const req = new HttpRequest<unknown>('GET', '/test');
    
    try {
      await firstValueFrom(httpRetryInterceptor(req, mockNext));
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toBe('Network failure');
      expect(attempts).toBe(1);
    }
  });

  it('retries on HTTP 429 and succeeds on a later attempt', async () => {
    let attempt = 0;
    const mockNext: HttpHandlerFn = () => {
      attempt++;
      if (attempt <= 2) {
        return throwError(
          () => new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests', url: '/test' })
        );
      }
      return of(new HttpResponse({ status: 200, body: 'OK' }));
    };
    const req = new HttpRequest<unknown>('GET', '/test');
    
    const res = await firstValueFrom(httpRetryInterceptor(req, mockNext));
    expect((res as HttpResponse<string>).body).toBe('OK');
    expect(attempt).toBe(3);
  }, 10000);

  it('exhausts retries and fails after 3 consecutive 429s', async () => {
    let attempt = 0;
    const mockNext: HttpHandlerFn = () => {
      attempt++;
      return throwError(
        () => new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests', url: '/test' })
      );
    };
    const req = new HttpRequest<unknown>('GET', '/test');
    
    try {
      await firstValueFrom(httpRetryInterceptor(req, mockNext));
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.status).toBe(429);
      expect(attempt).toBe(4);
    }
  }, 20000);
});
