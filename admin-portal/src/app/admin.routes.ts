import { Routes } from '@angular/router';

import { adminCapabilityGuard } from './admin-capability.guard';
import { AccessDeniedPageComponent } from './pages/access-denied-page.component';
import { AuditPageComponent } from './pages/audit-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { ModerationPageComponent } from './pages/moderation-page.component';
import { PlaceholderPageComponent } from './pages/placeholder-page.component';
import { UserDetailPageComponent } from './pages/user-detail-page.component';
import { UsersPageComponent } from './pages/users-page.component';

export const ADMIN_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'access-denied', component: AccessDeniedPageComponent },
  { path: '', pathMatch: 'full', component: DashboardPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'users', component: UsersPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'users/:id', component: UserDetailPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'moderation', component: ModerationPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'moderation.cases.read' } },
  { path: 'audit', component: AuditPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'audit.read' } },
  { path: 'logs', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'Logs', capability: 'logs.read' } },
  { path: 'system', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'System', capability: 'system.health.read' } },
  { path: '**', redirectTo: '' },
];
