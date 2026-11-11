import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../environments/environment';
import { AccountSuspensionNoticeService } from '../services/account-suspension-notice.service';
import { accountSuspensionInterceptor } from './account-suspension.interceptor';

describe('accountSuspensionInterceptor', () => {
  const handle = vi.fn();
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    handle.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([accountSuspensionInterceptor])),
        provideHttpClientTesting(),
        { provide: AccountSuspensionNoticeService, useValue: { handle } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  const fail = async (url: string, status: number, body: Record<string, string>) => {
    const result = firstValueFrom(http.get(url)).catch((caught: unknown) => caught);
    httpTesting.expectOne(url).flush(body, { status, statusText: 'x' });
    return result;
  };

  it('hands a first-party 403 body to the notice service and rethrows the error', async () => {
    const body = { code: 'ACCOUNT_SUSPENDED', suspendedUntil: '2026-12-01T12:00:00.000Z' };

    const error = await fail(`${environment.apiUrl}/moments`, 403, body);

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(handle).toHaveBeenCalledExactlyOnceWith(body);
  });

  it.each([401, 404, 426, 500])('does not react to HTTP %i', async (status) => {
    await fail(`${environment.apiUrl}/moments`, status, { code: 'ACCOUNT_SUSPENDED' });

    expect(handle).not.toHaveBeenCalled();
  });

  it('ignores a 403 from a third-party host', async () => {
    await fail('https://example.org/api/moments', 403, { code: 'ACCOUNT_SUSPENDED' });

    expect(handle).not.toHaveBeenCalled();
  });
});
