import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminGuard } from './admin.guard';
import { adminRoutes } from '../routes/admin.routes';
import { AdminService } from '../services/admin.service';

describe('adminGuard', () => {
  let adminServiceMock: { checkAdminAccess: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(() => {
    adminServiceMock = { checkAdminAccess: vi.fn() };

    TestBed.configureTestingModule({
      providers: [{ provide: AdminService, useValue: adminServiceMock }],
    });

    router = TestBed.inject(Router);
  });

  it('allows navigation when the backend confirms admin access', async () => {
    adminServiceMock.checkAdminAccess.mockResolvedValue(true);

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('redirects to discovery when the backend denies admin access', async () => {
    adminServiceMock.checkAdminAccess.mockResolvedValue(false);

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toEqual(router.parseUrl('/discovery'));
  });

  it('fails closed during server-side rendering without querying admin data', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: AdminService, useValue: adminServiceMock },
      ],
    });

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toBe(false);
    expect(adminServiceMock.checkAdminAccess).not.toHaveBeenCalled();
  });

  it('keeps every admin route behind the admin guard', () => {
    const privilegedRoutes = adminRoutes.filter(
      ({ path }) => path === 'admin' || path?.startsWith('admin/'),
    );

    expect(privilegedRoutes.map(({ path }) => path)).toEqual([
      'admin',
      'admin/lessons',
      'admin/moderation',
      'admin/blocks',
      'admin/users',
    ]);

    for (const route of privilegedRoutes) {
      expect(route.canActivate).toContain(adminGuard);
    }
  });
});
