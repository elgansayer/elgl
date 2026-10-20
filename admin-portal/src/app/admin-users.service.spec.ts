import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
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

  const user: AdminUserSummary = {
    id: 'user-1',
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

  it('normalizes invalid pagination before sending the request', async () => {
    httpGet.mockReturnValue(
      of({ users: [], total: 0, page: 1, pageSize: 20 } satisfies AdminUserListResult),
    );

    await firstValueFrom(service.search({ page: -9, pageSize: 1000 }));

    const [, options] = httpGet.mock.calls[0] as [
      string,
      { headers: HttpHeaders; params: HttpParams },
    ];
    expect(options.params.get('page')).toBe('1');
    expect(options.params.get('pageSize')).toBe('20');
  });

  it('rejects an overlong search before resolving the API endpoint', async () => {
    await expect(firstValueFrom(service.search({ search: 'x'.repeat(121) }))).rejects.toThrow(
      'Admin user search is too long',
    );

    expect(login.apiBaseUrl).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('validates list responses before exposing privileged user metadata', async () => {
    httpGet.mockReturnValueOnce(
      of({ users: [user], total: 1, page: 1, pageSize: 20 } satisfies AdminUserListResult),
    );
    await expect(firstValueFrom(service.search({}))).resolves.toEqual({
      users: [user],
      total: 1,
      page: 1,
      pageSize: 20,
    });

    httpGet.mockReturnValueOnce(
      of({ users: [{ ...user, avatar_url: 'javascript:alert(1)' }], total: 1, page: 1, pageSize: 20 }),
    );
    await expect(firstValueFrom(service.search({}))).rejects.toThrow('Admin user data unavailable');

    httpGet.mockReturnValueOnce(of({ users: [], total: -1, page: 1, pageSize: 20 }));
    await expect(firstValueFrom(service.search({}))).rejects.toThrow('Admin user data unavailable');
  });

  it('does not expose provider failure details to the admin browser', async () => {
    httpGet.mockReturnValue(
      throwError(() => new Error('postgres://user:secret@internal.example failed')),
    );

    await expect(firstValueFrom(service.search({}))).rejects.toThrow('Admin user data unavailable');
    await expect(firstValueFrom(service.getUser('user-1'))).rejects.toThrow(
      'Admin user data unavailable',
    );
    await expect(firstValueFrom(service.getLoginHistory('user-1'))).rejects.toThrow(
      'Admin user data unavailable',
    );
  });

  it('encodes user identifiers for detail and login-history requests', async () => {
    const encodedUser: AdminUserSummary = { ...user, id: 'user/with space' };
    const history: AdminLoginHistoryEntry[] = [];
    httpGet.mockReturnValueOnce(of(encodedUser)).mockReturnValueOnce(of(history));

    await expect(firstValueFrom(service.getUser(encodedUser.id))).resolves.toEqual(encodedUser);
    await expect(firstValueFrom(service.getLoginHistory(encodedUser.id))).resolves.toEqual(history);

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

  it('rejects malformed user detail and oversized login-history payloads', async () => {
    httpGet
      .mockReturnValueOnce(of({ ...user, study_streak_days: -1 }))
      .mockReturnValueOnce(
        of(
          Array.from({ length: 51 }, (_, index) => ({
            id: `login-${index}`,
            user_id: user.id,
            ip_address: null,
            user_agent: null,
            created_at: '2026-08-26T00:00:00.000Z',
          })),
        ),
      );

    await expect(firstValueFrom(service.getUser(user.id))).rejects.toThrow(
      'Admin user data unavailable',
    );
    await expect(firstValueFrom(service.getLoginHistory(user.id))).rejects.toThrow(
      'Admin user data unavailable',
    );
  });

  it('rejects invalid user identifiers before making an HTTP request', async () => {
    await expect(firstValueFrom(service.getUser('   '))).rejects.toThrow(
      'Invalid admin user identifier',
    );
    await expect(firstValueFrom(service.getLoginHistory('x'.repeat(129)))).rejects.toThrow(
      'Invalid admin user identifier',
    );

    expect(login.apiBaseUrl).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
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
