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
  let authServiceMock: { getAccessToken: ReturnType<typeof vi.fn> };

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
    authServiceMock = { getAccessToken: vi.fn().mockReturnValue('mock-token') };

    TestBed.configureTestingModule({
      providers: [
        AdminService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: authServiceMock,
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

  it('confirms admin access only after an authenticated backend probe succeeds', async () => {
    const promise = service.checkAdminAccess();

    const req = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/admin/users` &&
        request.params.get('page') === '1' &&
        request.params.get('pageSize') === '1',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer mock-token');
    req.flush({ users: [], total: 0, page: 1, pageSize: 1 });

    await expect(promise).resolves.toBe(true);
  });

  it('fails admin access closed when there is no authenticated access token', async () => {
    authServiceMock.getAccessToken.mockReturnValue(null);

    await expect(service.checkAdminAccess()).resolves.toBe(false);
    httpMock.expectNone(`${environment.apiUrl}/admin/users`);
  });

  it('fails admin access closed when the backend denies or cannot verify access', async () => {
    const forbiddenPromise = service.checkAdminAccess();
    const forbiddenReq = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/admin/users` &&
        request.params.get('page') === '1' &&
        request.params.get('pageSize') === '1',
    );
    forbiddenReq.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(forbiddenPromise).resolves.toBe(false);

    const networkPromise = service.checkAdminAccess();
    const networkReq = httpMock.expectOne(
      (request) =>
        request.url === `${environment.apiUrl}/admin/users` &&
        request.params.get('page') === '1' &&
        request.params.get('pageSize') === '1',
    );
    networkReq.error(new ProgressEvent('network error'));
    await expect(networkPromise).resolves.toBe(false);
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

  it('fails closed when the user list cannot be loaded', async () => {
    const networkPromise = service.listUsers('', 1, 20);
    const networkReq = httpMock.expectOne(`${environment.apiUrl}/admin/users?page=1&pageSize=20`);
    networkReq.error(new ProgressEvent('network error'));

    await expect(networkPromise).rejects.toBeTruthy();

    const forbiddenPromise = service.listUsers('', 1, 20);
    const forbiddenReq = httpMock.expectOne(`${environment.apiUrl}/admin/users?page=1&pageSize=20`);
    forbiddenReq.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(forbiddenPromise).rejects.toBeTruthy();
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

  it('posts a real ban mutation and propagates authorization failures', async () => {
    const successPromise = service.banUser('user-1');
    const successReq = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/ban`);
    expect(successReq.request.method).toBe('POST');
    expect(successReq.request.body).toEqual({});
    expect(successReq.request.headers.get('Authorization')).toBe('Bearer mock-token');
    successReq.flush({ message: 'User banned' });
    await expect(successPromise).resolves.toEqual({ message: 'User banned' });

    const failurePromise = service.banUser('user-1');
    const failureReq = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/ban`);
    failureReq.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(failurePromise).rejects.toBeTruthy();
  });

  it('posts a real warning mutation and propagates authorization failures', async () => {
    const successPromise = service.warnUser('user-1');
    const successReq = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/warn`);
    expect(successReq.request.method).toBe('POST');
    expect(successReq.request.body).toEqual({});
    expect(successReq.request.headers.get('Authorization')).toBe('Bearer mock-token');
    successReq.flush({ message: 'Warning sent' });
    await expect(successPromise).resolves.toEqual({ message: 'Warning sent' });

    const failurePromise = service.warnUser('user-1');
    const failureReq = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/warn`);
    failureReq.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });
    await expect(failurePromise).rejects.toBeTruthy();
  });

  it('fetches login history for a user', async () => {
    const promise = service.getLoginHistory('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/login-history`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'log-1', user_id: 'user-1', created_at: new Date().toISOString() }]);

    const result = await promise;
    expect(result.length).toBe(1);
  });

  it('fails closed when sensitive login history cannot be loaded', async () => {
    const promise = service.getLoginHistory('user-1');

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/users/user-1/login-history`);
    req.error(new ProgressEvent('network error'));

    await expect(promise).rejects.toBeTruthy();
  });

  it('fails closed when the global block list cannot be loaded', async () => {
    const promise = service.listAllBlocks(1, 20);

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/blocks?page=1&pageSize=20`);
    req.error(new ProgressEvent('network error'));

    await expect(promise).rejects.toBeTruthy();
  });
});
