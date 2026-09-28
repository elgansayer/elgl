import { TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { LinkedAccountsService } from './linked-accounts.service';
import { environment } from '../../environments/environment';

describe('LinkedAccountsService', () => {
  let service: LinkedAccountsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getBearerHeaders: vi
              .fn()
              .mockReturnValue(new HttpHeaders({ Authorization: 'Bearer test-token' })),
          },
        },
      ],
    });

    service = TestBed.inject(LinkedAccountsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads linked accounts from the authenticated current-user endpoint', async () => {
    const resultPromise = service.getLinkedAccounts();
    const request = httpTesting.expectOne(`${environment.apiUrl}/users/me/linked-accounts`);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');

    request.flush([
      { provider: 'google', active: true, created_at: '2026-08-22T00:00:00Z' },
      { provider: 'apple', active: false },
    ]);

    await expect(resultPromise).resolves.toEqual([
      { provider: 'google', active: true, created_at: '2026-08-22T00:00:00Z' },
      { provider: 'apple', active: false },
    ]);
  });

  it('links a provider through the authenticated link endpoint', async () => {
    const resultPromise = service.linkAccount('google', 'Primary Google');
    const request = httpTesting.expectOne(`${environment.apiUrl}/users/me/linked-accounts/link`);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({ provider: 'google', name: 'Primary Google' });

    request.flush(null);
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('unlinks a provider through the authenticated unlink endpoint', async () => {
    const resultPromise = service.unlinkAccount('apple');
    const request = httpTesting.expectOne(`${environment.apiUrl}/users/me/linked-accounts/unlink`);

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(request.request.body).toEqual({ provider: 'apple' });

    request.flush(null);
    await expect(resultPromise).resolves.toBeUndefined();
  });

  it('propagates API failures instead of reporting a successful account mutation', async () => {
    const resultPromise = service.linkAccount('facebook');
    const request = httpTesting.expectOne(`${environment.apiUrl}/users/me/linked-accounts/link`);

    request.flush({ message: 'provider unavailable' }, { status: 503, statusText: 'Unavailable' });

    await expect(resultPromise).rejects.toBeDefined();
  });
});
