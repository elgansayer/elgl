import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AdminService, AdminUserSummary } from './admin.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;

  const mockUser: AdminUserSummary = {
    id: 'user-1',
    display_name: 'Ada',
    native_languages: ['en'],
    target_languages: ['es'],
    is_vip: false,
    vip_tier: 'free',
    is_admin: false,
    coins_balance: 10,
    study_streak_days: 2,
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AdminService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn().mockReturnValue('mock-token') },
        },
      ],
    });

    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('lists users with search and pagination params, sending the auth header', async () => {
    const promise = service.listUsers('ada', 2, 20);

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/admin/users` &&
        r.params.get('search') === 'ada' &&
        r.params.get('page') === '2' &&
        r.params.get('pageSize') === '20',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({ users: [mockUser], total: 1, page: 2, pageSize: 20 });

    const result = await promise;
    expect(result.users).toEqual([mockUser]);
    expect(result.total).toBe(1);
  });

  it('falls back to mock data only on network errors (status 0), propagates HTTP errors', async () => {
    // Network error (status 0) - should fall back to mock data
    const networkPromise = service.listUsers('', 1, 20);
    const netReq = httpMock.expectOne(`${environment.apiUrl}/admin/users?page=1&pageSize=20`);
    netReq.error(new ProgressEvent('network error'));

    const netResult = await networkPromise;
    expect(netResult.users.length).toBeGreaterThan(0);

    // HTTP error (status 403) - should propagate
    const httpPromise = service.listUsers('', 1, 20);
    const httpReq = httpMock.expectOne(`${environment.apiUrl}/admin/users?page=1&pageSize=20`);
    httpReq.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(httpPromise).rejects.toBeTruthy();
  });

  it('sends a PATCH request to toggle VIP status', async () => {
    const promise = service.setVipStatus('user-1', true, 'consumer_8_ukp_10_usd');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/vip`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      is_vip: true,
      vip_tier: 'consumer_8_ukp_10_usd',
    });
    req.flush({ ...mockUser, is_vip: true, vip_tier: 'consumer_8_ukp_10_usd' });

    const result = await promise;
    expect(result.is_vip).toBe(true);
  });

  it('rejects instead of faking success when the VIP toggle request errors', async () => {
    const promise = service.setVipStatus('user-1', true, 'consumer_8_ukp_10_usd');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/vip`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(promise).rejects.toBeTruthy();
  });

  it('fetches login history for a user', async () => {
    const promise = service.getLoginHistory('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/login-history`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'log-1', user_id: 'user-1', created_at: new Date().toISOString() }]);

    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('posts to the authenticated ban endpoint without fabricating a mutation result', async () => {
    const promise = service.banUser('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/ban`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({ message: 'User banned' });

    await expect(promise).resolves.toEqual({ message: 'User banned' });
  });

  it('propagates ban endpoint failures to the admin UI', async () => {
    const promise = service.banUser('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/ban`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(promise).rejects.toBeTruthy();
  });

  it('posts to the authenticated warn endpoint without fabricating a mutation result', async () => {
    const promise = service.warnUser('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/warn`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({ message: 'User warned' });

    await expect(promise).resolves.toEqual({ message: 'User warned' });
  });

  it('propagates warn endpoint failures to the admin UI', async () => {
    const promise = service.warnUser('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/warn`);
    req.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(promise).rejects.toBeTruthy();
  });
});
