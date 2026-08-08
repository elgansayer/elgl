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

  it('passes through a successful response immediately', async () => {
    let receivedBody: string | undefined;
    const mockNext: HttpHandlerFn = () => of(new HttpResponse<string>({ body: 'OK', status: 200 }));
    const req = new HttpRequest<unknown>('GET', '/test');
    
    httpRetryInterceptor(req, mockNext).subscribe({
      next: (res) => {
        if (res instanceof HttpResponse) {
          receivedBody = (res.body as any) ?? undefined;
        }
      },
    });

    await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(receivedBody).toBe('OK');
  });

  it('does not retry on a non-429 error (404)', async () => {
    let caughtError: HttpErrorResponse | undefined;
    let attempts = 0;

    const mockNext: HttpHandlerFn = () => {
      attempts++;
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: '/test' }));
    };

    const req = new HttpRequest<unknown>('GET', '/test');
    httpRetryInterceptor(req, mockNext).subscribe({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse) {
          caughtError = err;
        }
      },
    });

    await new Promise<void>(resolve => setTimeout(resolve, 10));
    expect(caughtError).toBeTruthy();
    expect(caughtError?.status).toBe(404);
    expect(attempts).toBe(1);
  });
});
