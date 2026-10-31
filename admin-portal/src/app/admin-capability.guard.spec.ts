import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminCapabilityGuard } from './admin-capability.guard';
import { AdminAuthContextService, AdminContext } from './admin-auth-context.service';
import { AdminLoginService } from './admin-login.service';

describe('adminCapabilityGuard', () => {
  const load = vi.fn();
  const hasCapability = vi.fn();
  let token: string | null;
  let context: AdminContext | null;

  const adminContext: AdminContext = {
    user: { id: 'admin-1', email: null },
    capabilities: ['users.read'],
    authorizationModel: 'rbac-v1',
  };

  beforeEach(() => {
    load.mockReset();
    hasCapability.mockReset();
    token = 'admin-token';
    context = null;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdminLoginService, useValue: { accessToken: () => token } },
        {
          provide: AdminAuthContextService,
          useValue: { context: () => context, load, hasCapability },
        },
      ],
    });
  });

  async function decide(capability: string): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      adminCapabilityGuard(
        { data: { capability } } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    if (result instanceof Observable) return firstValueFrom(result) as Promise<boolean | UrlTree>;
    return (await result) as boolean | UrlTree;
  }

  function expectRedirect(result: boolean | UrlTree, url: string): void {
    expect(result).toBeInstanceOf(UrlTree);
    expect(String(result)).toBe(url);
  }

  it('sends an unauthenticated operator to sign-in without probing the API', async () => {
    token = null;

    expectRedirect(await decide('users.read'), '/login');

    expect(load).not.toHaveBeenCalled();
    expect(hasCapability).not.toHaveBeenCalled();
  });

  describe('with a cached admin context', () => {
    beforeEach(() => {
      context = adminContext;
    });

    it('allows a route whose capability the operator holds', async () => {
      hasCapability.mockReturnValue(true);

      await expect(decide('users.read')).resolves.toBe(true);

      expect(hasCapability).toHaveBeenCalledWith('users.read');
      expect(load).not.toHaveBeenCalled();
    });

    it('redirects to access denied when the capability is missing', async () => {
      hasCapability.mockReturnValue(false);

      expectRedirect(await decide('users.sessions.read'), '/access-denied');

      expect(load).not.toHaveBeenCalled();
    });
  });

  describe('without a cached admin context', () => {
    it('loads the server-side context once and allows a held capability', async () => {
      load.mockReturnValue(of(adminContext));
      hasCapability.mockReturnValue(true);

      await expect(decide('users.read')).resolves.toBe(true);

      expect(load).toHaveBeenCalledTimes(1);
      expect(hasCapability).toHaveBeenCalledWith('users.read');
    });

    it('redirects to access denied when the loaded context lacks the capability', async () => {
      load.mockReturnValue(of(adminContext));
      hasCapability.mockReturnValue(false);

      expectRedirect(await decide('roles.read'), '/access-denied');
    });

    it('fails closed to sign-in when the context cannot be loaded', async () => {
      load.mockReturnValue(throwError(() => new Error('unavailable')));

      expectRedirect(await decide('users.read'), '/login');

      expect(hasCapability).not.toHaveBeenCalled();
    });
  });
});
