import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

const DEFAULT_AUTHENTICATED_ROUTE = '/learn/ai-chat';

function safeReturnUrl(value: string | null): string {
  if (!value) return DEFAULT_AUTHENTICATED_ROUTE;
  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTHENTICATED_ROUTE;
  }
  return value;
}

/**
 * Fail-closed guard for authenticated feature routes: waits for the initial
 * session restore, then redirects signed-out visitors to `/login` with the
 * attempted URL so sign-in can return them there.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  if (isPlatformServer(inject(PLATFORM_ID))) return false;

  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  if (auth.isAuthenticated()) return true;

  return router.parseUrl(
    `/login?returnUrl=${encodeURIComponent(state.url)}`,
  );
};

/**
 * Keeps signed-in users away from the sign-in and registration screens.
 */
export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ready;
  if (!auth.isAuthenticated()) return true;

  return router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl')));
};
