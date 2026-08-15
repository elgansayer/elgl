import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AdminAuthContextService } from './admin-auth-context.service';

export const adminCapabilityGuard: CanActivateFn = (route) => {
  const auth = inject(AdminAuthContextService);
  const router = inject(Router);
  const capability = route.data['capability'] as string | undefined;

  if (!capability) {
    return true;
  }

  const current = auth.context();
  if (current) {
    return auth.hasCapability(capability)
      ? true
      : router.createUrlTree(['/access-denied']);
  }

  return auth.load().pipe(
    map(() =>
      auth.hasCapability(capability)
        ? true
        : router.createUrlTree(['/access-denied']),
    ),
    catchError(() => of(router.createUrlTree(['/access-denied']))),
  );
};
