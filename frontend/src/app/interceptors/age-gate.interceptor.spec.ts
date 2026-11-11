import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { AgeGateService } from '../services/age-gate.service';
import { ageGateInterceptor } from './age-gate.interceptor';

describe('ageGateInterceptor', () => {
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  const recordRejection = vi.fn();
  let currentUrl = '/discovery';
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.clearAllMocks();
    currentUrl = '/discovery';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([ageGateInterceptor])),
        provideHttpClientTesting(),
        {
          provide: Router,
          useValue: {
            navigateByUrl,
            get url() {
              return currentUrl;
            },
          },
        },
        { provide: AgeGateService, useValue: { recordRejection } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function failWith(status: number, body: string | object): Promise<unknown> {
    const result = firstValueFrom(http.get('/api/anything')).catch((error: unknown) => error);
    httpMock.expectOne('/api/anything').flush(body, { status, statusText: 'Error' });
    return result;
  }

  it.each(['AGE_GATE_REQUIRED', 'AGE_GATE_BLOCKED'])(
    'sends the user to the age gate when the server answers %s',
    async (code) => {
      const error = await failWith(403, { statusCode: 403, code });

      expect(recordRejection).toHaveBeenCalledWith(code);
      expect(navigateByUrl).toHaveBeenCalledWith('/age-gate');
      // The original failure still reaches the caller so its work stops.
      expect(error).toMatchObject({ status: 403 });
    },
  );

  it('does not loop when the user is already on the age-gate screen', async () => {
    currentUrl = '/age-gate';
    await failWith(403, { code: 'AGE_GATE_REQUIRED' });

    expect(recordRejection).toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it.each([
    [403, { message: 'Forbidden' }],
    [403, { code: 'ADMIN_ONLY' }],
    [403, 'AGE_GATE_REQUIRED'],
    [401, { code: 'AGE_GATE_REQUIRED' }],
    [500, { code: 'AGE_GATE_BLOCKED' }],
  ])('leaves a %i response with %j alone', async (status, body) => {
    await failWith(status, body);

    expect(recordRejection).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('passes successful responses through', async () => {
    const result = firstValueFrom(http.get('/api/anything'));
    httpMock.expectOne('/api/anything').flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
