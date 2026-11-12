import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAuthContextService, AdminContext } from './admin-auth-context.service';
import { AdminLoginService } from './admin-login.service';

describe('AdminAuthContextService', () => {
  const httpGet = vi.fn();
  let token: string | null;
  let login: { accessToken: ReturnType<typeof vi.fn>; apiBaseUrl: ReturnType<typeof vi.fn> };
  let service: AdminAuthContextService;

  const context: AdminContext = {
    user: { id: 'admin-1', email: 'admin@example.test' },
    capabilities: ['users.read', 'users.sessions.read'],
    authorizationModel: 'rbac-v1',
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
        AdminAuthContextService,
        { provide: HttpClient, useValue: { get: httpGet } },
        { provide: AdminLoginService, useValue: login },
      ],
    });
    service = TestBed.inject(AdminAuthContextService);
  });

  it('starts without a context and grants no capability', () => {
    expect(service.context()).toBeNull();
    expect(service.hasCapability('users.read')).toBe(false);
  });

  it('loads the effective capabilities from the versioned me endpoint with bearer auth', async () => {
    httpGet.mockReturnValue(of(context));

    await expect(firstValueFrom(service.load())).resolves.toEqual(context);

    expect(httpGet).toHaveBeenCalledTimes(1);
    const [url, options] = httpGet.mock.calls[0] as [string, { headers: HttpHeaders }];
    expect(url).toBe('https://api.example.test/admin/v1/me');
    expect(options.headers.get('Authorization')).toBe('Bearer admin-token');
    expect(service.context()).toEqual(context);
    expect(service.hasCapability('users.read')).toBe(true);
    expect(service.hasCapability('users.sessions.read')).toBe(true);
    expect(service.hasCapability('roles.read')).toBe(false);
  });

  it('refuses to load without a token and never resolves the API base URL', async () => {
    token = null;

    await expect(firstValueFrom(service.load())).rejects.toThrow('Admin authentication required');

    expect(login.apiBaseUrl).not.toHaveBeenCalled();
    expect(httpGet).not.toHaveBeenCalled();
    expect(service.context()).toBeNull();
  });

  it('forgets every capability when cleared', async () => {
    httpGet.mockReturnValue(of(context));
    await firstValueFrom(service.load());

    service.clear();

    expect(service.context()).toBeNull();
    expect(service.hasCapability('users.read')).toBe(false);
  });
});
