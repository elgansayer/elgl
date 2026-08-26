import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminLoginService } from './admin-login.service';
import {
  AdminLoginHistoryEntry,
  AdminUserListResult,
  AdminUserSummary,
  AdminUsersService,
} from './admin-users.service';

describe('AdminUsersService', () => {
  const httpGet = vi.fn();
  let token: string | null;
  let service: AdminUsersService;
  let login: {
    accessToken: ReturnType<typeof vi.fn>;
    apiBaseUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    token = 'admin-token';
    httpGet.mockReset();
    login = {
      accessToken: vi.fn(() => token),
      apiBaseUrl: vi.fn(async () => 'https://api.example.test'),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        { provide: HttpClient, useValue: { get: httpGet } },
        { provide: AdminLoginService, useValue: login },
      ],
    });

    service = TestBed.inject(AdminUsersService);
  });

  it('searches the bounded admin user endpoint with trimmed query and bearer auth', async () => {
    const result: AdminUserListResult = {
      users: [],
      total: 0,
      page: 2,
      pageSize: 25,
    };
    httpGet.mockReturnValue(of(result));

    await expect(
      firstValueFrom(
        service.search({ page: 2, pageSize: 25, search: '  Alice Example  ' }),
      ),
    ).resolves.toEqual(result);

    expect(login.apiBaseUrl).toHaveBeenCalledTimes(1);
    expect(httpGet).toHaveBeenCalledTimes(1);
    const [url, options] = httpGet.mock.calls[0] as [
      string,
      { headers: HttpHeaders; params: HttpParams },
    ];
    expect(url).toBe('https://api.example.test/admin/v1/users');
    expect(options.headers.get('Authorization')).toBe('Bearer admin-token');
    expect(options.params.get('page')).toBe('2');
    expect(options.params.get('pageSize')).toBe('25');
    expect(options.params.get('search')).toBe('Alice Example');
  });

  it('does not send an empty search parameter', async () => {
    httpGet.mockReturnValue(
      of({ users: [], total: 0, page: 1, pageSize: 20 } satisfies AdminUserListResult),
    );

    await firstValueFrom(service.search({ search: '   ' }));

    const [, options] = httpGet.mock.calls[0] as [
      string,
      { headers: HttpHeaders; params: HttpParams },
    ];
    expect(options.params.has('search')).toBe(false);
  });

  it('encodes user identifiers for detail and login-history requests', async () => {
    const user: AdminUserSummary = {
      id: 'user/with space',
      display_name: 'Alice',
      avatar_url: null,
      native_languages: ['en'],
      target_languages: ['ja'],
      is_vip: false,
      vip_tier: null,
      is_admin: false,
      coins_balance: 0,
      study_streak_days: 3,
      last_active_at: null,
      created_at: null,
    };
    const history: AdminLoginHistoryEntry[] = [];
    httpGet.mockReturnValueOnce(of(user)).mockReturnValueOnce(of(history));

    await expect(firstValueFrom(service.getUser(user.id))).resolves.toEqual(user);
    await expect(firstValueFrom(service.getLoginHistory(user.id))).resolves.toEqual(history);

    expect(httpGet.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/admin/v1/users/user%2Fwith%20space',
    );
    expect(httpGet.mock.calls[1]?.[0]).toBe(
      'https://api.example.test/admin/v1/users/user%2Fwith%20space/login-history',
    );
    for (const call of httpGet.mock.calls) {
      const options = call[1] as { headers: HttpHeaders };
      expect(options.headers.get('Authorization')).toBe('Bearer admin-token');
    }
  });

  it('fails closed before resolving the API base URL when admin authentication is missing', async () => {
    token = null;

    await expect(firstValueFrom(service.search({}))).rejects.toThrow(
      'Admin authentication required',
    );
    await expect(firstValueFrom(service.getUser('user-1'))).rejects.toThrow(
      'Admin authentication required',
    );
    await expect(firstValueFrom(service.getLoginHistory('user-1'))).rejects.toThrow(
      'Admin authentication required',
    );

    expect(login.apiBaseUrl).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
  });
});
