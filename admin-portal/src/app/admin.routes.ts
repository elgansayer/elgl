import { Routes } from '@angular/router';

import { adminCapabilityGuard } from './admin-capability.guard';
import { AccessDeniedPageComponent } from './pages/access-denied-page.component';
import { AuditPageComponent } from './pages/audit-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { LogsPageComponent } from './pages/logs-page.component';
import { ModerationPageComponent } from './pages/moderation-page.component';
import { NetworkSecurityPageComponent } from './pages/network-security-page.component';
import { RoleAssignmentsPageComponent } from './pages/role-assignments-page.component';
import { RolesPageComponent } from './pages/roles-page.component';
import { SystemHealthPageComponent } from './pages/system-health-page.component';
import { UserDetailPageComponent } from './pages/user-detail-page.component';
import { UsersPageComponent } from './pages/users-page.component';

export const ADMIN_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'access-denied', component: AccessDeniedPageComponent },
  { path: '', pathMatch: 'full', component: DashboardPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'users', component: UsersPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'users/:id', component: UserDetailPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'moderation', component: ModerationPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'moderation.cases.read' } },
  { path: 'network-security', component: NetworkSecurityPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'security.network.read' } },
  { path: 'roles', component: RolesPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'roles.read' } },
  { path: 'roles/assignments', component: RoleAssignmentsPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'roles.read' } },
  { path: 'audit', component: AuditPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'audit.read' } },
  { path: 'logs', component: LogsPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'logs.read' } },
  { path: 'system', component: SystemHealthPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'system.health.read' } },
  { path: '**', redirectTo: '' },
];
