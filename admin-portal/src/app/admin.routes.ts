import { Routes } from '@angular/router';

import { adminCapabilityGuard } from './admin-capability.guard';
import { AccessDeniedPageComponent } from './pages/access-denied-page.component';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { PlaceholderPageComponent } from './pages/placeholder-page.component';

export const ADMIN_ROUTES: Routes = [
  { path: 'login', component: LoginPageComponent },
  { path: 'access-denied', component: AccessDeniedPageComponent },
  { path: '', pathMatch: 'full', component: DashboardPageComponent, canActivate: [adminCapabilityGuard], data: { capability: 'users.read' } },
  { path: 'users', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'Users', capability: 'users.read' } },
  { path: 'moderation', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'Moderation', capability: 'moderation.cases.read' } },
  { path: 'audit', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'Audit', capability: 'audit.read' } },
  { path: 'logs', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'Logs', capability: 'logs.read' } },
  { path: 'system', component: PlaceholderPageComponent, canActivate: [adminCapabilityGuard], data: { title: 'System', capability: 'system.health.read' } },
  { path: '**', redirectTo: '' },
];
