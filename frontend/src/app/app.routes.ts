import { Routes } from '@angular/router';

import { adminRoutes } from './routes/admin.routes';
import { authRoutes } from './routes/auth.routes';
import { chatRoutes } from './routes/chat.routes';
import { commerceRoutes } from './routes/commerce.routes';
import { learningRoutes } from './routes/learning.routes';
import { mediaRoutes } from './routes/media.routes';
import { settingsRoutes } from './routes/settings.routes';
import { socialRoutes } from './routes/social.routes';

export const routes: Routes = [
  { path: '', redirectTo: 'ai-conversation', pathMatch: 'full' },

  // Legacy deep-link redirects mapped to consolidated domain routes
  { path: 'notification-preferences', redirectTo: 'settings/notification', pathMatch: 'full' },
  { path: 'language', redirectTo: 'settings/language', pathMatch: 'full' },
  { path: 'blocks', redirectTo: 'settings/blocks', pathMatch: 'full' },
  { path: 'message-filters', redirectTo: 'settings/message-filters', pathMatch: 'full' },
  { path: 'chat-settings', redirectTo: 'settings/chat', pathMatch: 'full' },
  { path: 'data-storage', redirectTo: 'settings/data-storage', pathMatch: 'full' },
  { path: 'my-subscription', redirectTo: 'settings/subscription', pathMatch: 'full' },

  { path: 'groups', redirectTo: 'community/groups', pathMatch: 'full' },
  { path: 'groups/create', redirectTo: 'community/groups/create', pathMatch: 'full' },
  { path: 'communities', redirectTo: 'community', pathMatch: 'full' },
  { path: 'language-islands', redirectTo: 'community/language-islands', pathMatch: 'full' },
  { path: 'language-parties', redirectTo: 'community/language-parties', pathMatch: 'full' },

  { path: 'visitors', redirectTo: 'profile/visitors', pathMatch: 'full' },
  { path: 'help-about', redirectTo: 'support', pathMatch: 'full' },

  // Global app routes
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Home - HelloTalk',
  },

  // Domain-specific routes (consolidated architecture)
  ...adminRoutes,
  ...authRoutes,
  ...chatRoutes,
  ...commerceRoutes,
  ...learningRoutes,
  ...mediaRoutes,
  ...settingsRoutes,
  ...socialRoutes,
];
