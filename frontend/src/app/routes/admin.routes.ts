import { Routes } from '@angular/router';
import { adminGuard } from '../guards/admin.guard';

export const adminRoutes: Routes = [
  {
    path: 'admin',
    loadComponent: () =>
      import('../components/admin-portal/admin-portal.component').then(
        (m) => m.AdminPortalComponent,
      ),
    canActivate: [adminGuard],
    title: 'Admin Portal - HelloTalk',
  },
  {
    path: 'admin/lessons',
    loadComponent: () =>
      import('../components/lesson-manager/lesson-manager.component').then(
        (m) => m.LessonManagerComponent,
      ),
    canActivate: [adminGuard],
    title: 'Lesson Management - HelloTalk',
  },
  {
    path: 'admin/moderation',
    loadComponent: () =>
      import('../moderation/moderation-queue.component').then((m) => m.ModerationQueueComponent),
    canActivate: [adminGuard],
    title: 'Moderation - HelloTalk',
  },
  {
    path: 'admin/blocks',
    loadComponent: () =>
      import('../pages/admin/blocks/admin-blocks.component').then((m) => m.AdminBlocksComponent),
    canActivate: [adminGuard],
    title: 'Block Management - HelloTalk',
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('../pages/admin/admin-users.component').then((m) => m.AdminUsersComponent),
    canActivate: [adminGuard],
    title: 'Admin Users - HelloTalk',
  },
  {
    path: 'developer',
    loadComponent: () =>
      import('../components/developer-dashboard/developer-dashboard.component').then(
        (m) => m.DeveloperDashboardComponent,
      ),
  },
];
