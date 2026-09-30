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
  { path: '', redirectTo: 'ai-conversation', pathMatch: 'full' },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
    title: 'Home - HelloTalk',
  },
  {
    path: 'community',
    loadComponent: () =>
      import('./components/communities/communities.component').then((m) => m.CommunitiesComponent),
    title: 'Communities - HelloTalk',
  },
  ...authRoutes,
  ...mediaRoutes,
  ...learningRoutes,
  ...commerceRoutes,
  ...socialRoutes,
  ...settingsRoutes,
  ...chatRoutes,
  ...adminRoutes,
  {
    path: 'notification-preferences',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
  },
  {
    path: 'groups',
    redirectTo: 'community/groups',
    pathMatch: 'full',
  },
  {
    path: 'groups/create',
    redirectTo: 'community/groups/create',
    pathMatch: 'full',
  },
  {
    path: 'communities',
    redirectTo: 'community',
    pathMatch: 'full',
  },
  {
    path: 'visitors',
    redirectTo: 'profile/visitors',
    pathMatch: 'full',
  },
  {
    path: 'settings/notification-customization',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
  },
  {
    path: 'vip',
    redirectTo: 'subscription',
    pathMatch: 'full',
  },
  {
    path: 'help',
    redirectTo: 'support',
    pathMatch: 'full',
  },
  {
    path: 'language',
    redirectTo: 'settings/language',
    pathMatch: 'full',
  },
  {
    path: 'blocks',
    redirectTo: 'settings/blocks',
    pathMatch: 'full',
  },
  {
    path: 'message-filters',
    redirectTo: 'settings/message-filters',
    pathMatch: 'full',
  },
  {
    path: 'chat-settings',
    redirectTo: 'settings/chat',
    pathMatch: 'full',
  },
  {
    path: 'data-storage',
    redirectTo: 'settings/data-storage',
    pathMatch: 'full',
  },
  {
    path: 'help-about',
    redirectTo: 'support',
    pathMatch: 'full',
  },
  {
    path: 'my-subscription',
    redirectTo: 'settings/subscription',
    pathMatch: 'full',
  },
  {
    path: 'language-islands',
    redirectTo: 'community/language-islands',
    pathMatch: 'full',
  },
  {
    path: 'language-parties',
    redirectTo: 'community/language-parties',
    pathMatch: 'full',
  },
];
