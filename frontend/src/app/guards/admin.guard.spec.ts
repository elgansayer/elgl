import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminGuard } from './admin.guard';
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

  it('fails closed when the admin access probe unexpectedly rejects', async () => {
    adminServiceMock.checkAdminAccess.mockRejectedValue(new Error('authorization provider unavailable'));

    const result = await TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));

    expect(result).toEqual(router.parseUrl('/discovery'));
  });
});
