import { Route, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

import { authRoutes } from './routes/auth.routes';
import { mediaRoutes } from './routes/media.routes';
import { learningRoutes } from './routes/learning.routes';
import { commerceRoutes } from './routes/commerce.routes';
import { socialRoutes } from './routes/social.routes';
import { settingsRoutes } from './routes/settings.routes';
import { chatRoutes } from './routes/chat.routes';
import { adminRoutes } from './routes/admin.routes';
import { eventDetailRoutes } from './routes/events.routes';

const protect = (route: Route): Route => {
  if (!route.loadComponent && !route.loadChildren) return route;
  return {
    ...route,
    canActivate: [...(route.canActivate ?? []), authGuard],
  };
};

export const routes: Routes = [
  { path: '', redirectTo: 'learn/ai-chat', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Home - HelloTalk',
  },
  {
    path: 'community',
    redirectTo: 'chat/groups',
    pathMatch: 'full',
  },
  ...authRoutes,
  ...mediaRoutes.map(protect),
  ...learningRoutes.map(protect),
  ...commerceRoutes.map(protect),
  ...socialRoutes.map(protect),
  ...settingsRoutes.map(protect),
  ...chatRoutes.map(protect),
  ...adminRoutes.map(protect),
  // Event detail must be composed before the wildcard redirect.
  ...eventDetailRoutes.map(protect),
  { path: '**', redirectTo: 'learn/ai-chat' },
];
