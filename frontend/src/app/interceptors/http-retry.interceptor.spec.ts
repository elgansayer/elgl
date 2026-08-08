import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { of, throwError, firstValueFrom } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { httpRetryInterceptor } from './http-retry.interceptor';

describe('httpRetryInterceptor', () => {
  it('should be a function', () => {
    expect(typeof httpRetryInterceptor).toBe('function');
  });

  it('passes through a successful response immediately', async () => {
    const mockNext: HttpHandlerFn = () =>
      of(new HttpResponse<string>({ body: 'OK', status: 200 }));

    const req = new HttpRequest<unknown>('GET', '/test');

    const res = await firstValueFrom(httpRetryInterceptor(req, mockNext));
    expect(res instanceof HttpResponse).toBe(true);
    if (res instanceof HttpResponse) {
      expect(res.body).toBe('OK');
    }
  });

  it('does not retry on a non-429 error (404)', async () => {
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

    let caughtStatus = 0;
    try {
      await firstValueFrom(httpRetryInterceptor(req, mockNext));
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse) {
        caughtStatus = err.status;
      }
    }
    expect(caughtStatus).toBe(404);
    expect(attempts).toBe(1);
  });

  it('does not retry on non-HttpErrorResponse errors', async () => {
    let attempts = 0;

    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(() => new Error('Network failure'));
    };

    const req = new HttpRequest<unknown>('GET', '/test');

    await expect(firstValueFrom(httpRetryInterceptor(req, mockNext))).rejects.toThrow(
      'Network failure',
    );
    expect(attempts).toBe(1);
  });
});