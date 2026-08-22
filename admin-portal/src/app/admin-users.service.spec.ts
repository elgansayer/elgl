import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLoginService } from './admin-login.service';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let http: HttpTestingController;
  const login = {
    accessToken: vi.fn<() => string | null>(() => 'admin-token'),
    apiBaseUrl: vi.fn<() => Promise<string>>(async () => 'https://api.example.test'),
  };

  beforeEach(() => {
    login.accessToken.mockReturnValue('admin-token');
    login.apiBaseUrl.mockResolvedValue('https://api.example.test');

    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminLoginService, useValue: login },
      ],
    });

    service = TestBed.inject(AdminUsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.clearAllMocks();
  });

  it('fails before making a request when the admin session has no token', async () => {
    login.accessToken.mockReturnValue(null);

    await expect(firstValueFrom(service.search({ page: 1, pageSize: 20 }))).rejects.toThrow(
      'Admin authentication required',
    );
  });

  it('searches bounded user metadata with auth, pagination and a trimmed query', async () => {
    const resultPromise = firstValueFrom(
      service.search({ page: 2, pageSize: 20, search: '  Ada  ' }),
    );
    await Promise.resolve();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === 'https://api.example.test/admin/v1/users' &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('pageSize') === '20' &&
        candidate.params.get('search') === 'Ada',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({ users: [], total: 0, page: 2, pageSize: 20 });

    await expect(resultPromise).resolves.toEqual({ users: [], total: 0, page: 2, pageSize: 20 });
  });

  it('propagates user-search authorization failures without substituting data', async () => {
    const resultPromise = firstValueFrom(service.search({ page: 1, pageSize: 20 }));
    await Promise.resolve();

    const request = http.expectOne('https://api.example.test/admin/v1/users?page=1&pageSize=20');
    request.flush({ message: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('encodes user identifiers and authenticates user detail requests', async () => {
    const resultPromise = firstValueFrom(service.getUser('user/with space'));
    await Promise.resolve();

    const request = http.expectOne('https://api.example.test/admin/v1/users/user%2Fwith%20space');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush({
      id: 'user/with space',
      display_name: null,
      avatar_url: null,
      native_languages: null,
      target_languages: null,
      is_vip: false,
      vip_tier: null,
      is_admin: false,
      coins_balance: 0,
      study_streak_days: 0,
      last_active_at: null,
      created_at: null,
    });

    await expect(resultPromise).resolves.toMatchObject({ id: 'user/with space' });
  });

  it('keeps sensitive login-history reads authenticated and fail closed', async () => {
    const resultPromise = firstValueFrom(service.getLoginHistory('user-1'));
    await Promise.resolve();

    const request = http.expectOne('https://api.example.test/admin/v1/users/user-1/login-history');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.error(new ProgressEvent('network error'));

    await expect(resultPromise).rejects.toBeTruthy();
  });
});
