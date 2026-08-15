import { Routes } from '@angular/router';

import { DashboardPageComponent } from './pages/dashboard-page.component';
import { PlaceholderPageComponent } from './pages/placeholder-page.component';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: DashboardPageComponent },
  { path: 'users', component: PlaceholderPageComponent, data: { title: 'Users', capability: 'users.read' } },
  { path: 'moderation', component: PlaceholderPageComponent, data: { title: 'Moderation', capability: 'moderation.cases.read' } },
  { path: 'audit', component: PlaceholderPageComponent, data: { title: 'Audit', capability: 'audit.read' } },
  { path: 'logs', component: PlaceholderPageComponent, data: { title: 'Logs', capability: 'logs.read' } },
  { path: 'system', component: PlaceholderPageComponent, data: { title: 'System', capability: 'system.health.read' } },
  { path: '**', redirectTo: '' },
];
