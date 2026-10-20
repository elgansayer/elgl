import { Routes } from '@angular/router';

import { authRoutes } from './routes/auth.routes';
import { mediaRoutes } from './routes/media.routes';
import { learningRoutes } from './routes/learning.routes';
import { commerceRoutes } from './routes/commerce.routes';
import { socialRoutes } from './routes/social.routes';
import { settingsRoutes } from './routes/settings.routes';
import { chatRoutes } from './routes/chat.routes';
import { adminRoutes } from './routes/admin.routes';

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
  ...mediaRoutes,
  ...learningRoutes,
  ...commerceRoutes,
  ...socialRoutes,
  ...settingsRoutes,
  ...chatRoutes,
  ...adminRoutes,
  { path: '**', redirectTo: 'learn/ai-chat' },
];
