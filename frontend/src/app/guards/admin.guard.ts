import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AdminService } from '../services/admin.service';

export const adminGuard: CanActivateFn = async () => {
  const platformId = inject(PLATFORM_ID);
  if (isPlatformServer(platformId)) {
    return false;
  }

  const adminService = inject(AdminService);
  const router = inject(Router);

  try {
    const isAdmin = await adminService.checkAdminAccess();
    if (isAdmin) {
      return true;
    }
  } catch {
    // The service currently resolves false for authorization/provider failures,
    // but the route boundary must remain fail-closed if that contract changes.
  }

  return router.parseUrl('/discovery');
};
