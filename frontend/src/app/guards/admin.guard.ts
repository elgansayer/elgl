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

  const isAdmin = await adminService.checkAdminAccess();
  if (isAdmin) {
    return true;
  }

  return router.parseUrl('/discovery');
};
