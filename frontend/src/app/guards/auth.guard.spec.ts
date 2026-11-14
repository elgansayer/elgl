import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('authGuard', () => {
  let isAuthenticated: boolean;
  let parseUrl: ReturnType<typeof vi.fn>;

  const state = { url: '/chat/room-1?draft=1' } as RouterStateSnapshot;
  const route = {} as ActivatedRouteSnapshot;

  beforeEach(() => {
    isAuthenticated = false;
    parseUrl = vi.fn((url: string) => ({ url }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            ready: Promise.resolve(),
            isAuthenticated: () => isAuthenticated,
          },
        },
        { provide: Router, useValue: { parseUrl } },
      ],
    });
  });

  it('allows an authenticated user through', async () => {
    isAuthenticated = true;

    const result = await TestBed.runInInjectionContext(() =>
      authGuard(route, state),
    );

    expect(result).toBe(true);
    expect(parseUrl).not.toHaveBeenCalled();
  });

  it('redirects a signed-out user to login with the attempted URL', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      authGuard(route, state),
    );

    expect(parseUrl).toHaveBeenCalledWith(
      `/login?returnUrl=${encodeURIComponent('/chat/room-1?draft=1')}`,
    );
    expect(result).toEqual({
      url: `/login?returnUrl=${encodeURIComponent('/chat/room-1?draft=1')}`,
    });
  });
});

describe('guestGuard', () => {
  let isAuthenticated: boolean;
  let parseUrl: ReturnType<typeof vi.fn>;

  const routeWith = (returnUrl?: string) =>
    ({
      queryParamMap: {
        get: (key: string) => (key === 'returnUrl' ? returnUrl : null),
      },
    }) as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    isAuthenticated = false;
    parseUrl = vi.fn((url: string) => ({ url }));

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            ready: Promise.resolve(),
            isAuthenticated: () => isAuthenticated,
          },
        },
        { provide: Router, useValue: { parseUrl } },
      ],
    });
  });

  it('allows signed-out visitors to reach login and registration', async () => {
    const result = await TestBed.runInInjectionContext(() =>
      guestGuard(routeWith(), {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
  });

  it('sends an authenticated user to the requested return URL', async () => {
    isAuthenticated = true;

    const result = await TestBed.runInInjectionContext(() =>
      guestGuard(routeWith('/settings'), {} as RouterStateSnapshot),
    );

    expect(parseUrl).toHaveBeenCalledWith('/settings');
    expect(result).toEqual({ url: '/settings' });
  });

  it('refuses protocol-relative return URLs', async () => {
    isAuthenticated = true;

    await TestBed.runInInjectionContext(() =>
      guestGuard(routeWith('//evil.example'), {} as RouterStateSnapshot),
    );

    expect(parseUrl).toHaveBeenCalledWith('/learn/ai-chat');
  });
});
