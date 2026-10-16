import { Routes } from '@angular/router';

export const socialRoutes: Routes = [
  {
    path: 'discovery',
    loadComponent: () =>
      import('../components/discovery/discovery.component').then((m) => m.DiscoveryComponent),
  },
  {
    path: 'moments',
    loadComponent: () =>
      import('../components/moments-feed/moments-feed.component').then(
        (m) => m.MomentsFeedComponent,
      ),
  },
  {
    path: 'profile/me',
    loadComponent: () =>
      import('../components/profile/profile.component').then((m) => m.ProfileComponent),
  },
  {
    path: 'profile',
    redirectTo: 'profile/me',
    pathMatch: 'full',
  },
  {
    path: 'profile/:userId',
    loadComponent: () =>
      import('../components/user-detail/user-detail.component').then((m) => m.UserDetailComponent),
  },
  {
    path: 'profile/:userId/followers',
    loadComponent: () =>
      import('../components/follow-list/follow-list.component').then((m) => m.FollowListComponent),
    data: { mode: 'followers' },
    title: 'Followers - HelloTalk',
  },
  {
    path: 'profile/:userId/following',
    loadComponent: () =>
      import('../components/follow-list/follow-list.component').then((m) => m.FollowListComponent),
    data: { mode: 'following' },
    title: 'Following - HelloTalk',
  },
  {
    path: 'visitors',
    redirectTo: 'profile/me/visitors',
    pathMatch: 'full',
  },
  {
    path: 'profile/visitors',
    redirectTo: 'profile/me/visitors',
    pathMatch: 'full',
  },
  {
    path: 'profile/me/visitors',
    loadComponent: () =>
      import('../components/profile-visitors/profile-visitors.component').then(
        (m) => m.ProfileVisitorsComponent,
      ),
  },
  {
    path: 'profile/me/favourites',
    loadComponent: () =>
      import('../components/favourites/favourites.component').then((m) => m.FavouritesComponent),
  },
  {
    path: 'favourites',
    redirectTo: 'profile/me/favourites',
    pathMatch: 'full',
  },
  {
    path: 'leaderboard',
    loadComponent: () =>
      import('../components/leaderboard/leaderboard.component').then((m) => m.LeaderboardComponent),
  },
  {
    path: 'hobby-tags',
    loadComponent: () =>
      import('../components/hobby-tags/hobby-tags.component').then((m) => m.HobbyTagsComponent),
  },
  {
    path: 'profile/me/stats',
    loadComponent: () =>
      import('../components/my-stats/my-stats.component').then((m) => m.MyStatsComponent),
  },
  {
    path: 'stats',
    redirectTo: 'profile/me/stats',
    pathMatch: 'full',
  },
  {
    path: 'milestones',
    redirectTo: 'profile/me/stats',
    pathMatch: 'full',
  },
  {
    path: 'notifications',
    loadComponent: () =>
      import('../components/notifications-inbox/notifications-inbox.component').then(
        (m) => m.NotificationsInboxComponent,
      ),
  },
  {
    path: 'notification-preferences',
    redirectTo: 'settings/notification',
    pathMatch: 'full',
  },
  {
    path: 'events',
    redirectTo: 'live/events',
    pathMatch: 'full',
  },
  {
    path: 'events/calendar',
    redirectTo: 'live/events',
    pathMatch: 'full',
  },
  {
    path: 'language-parties',
    redirectTo: 'live/events',
    pathMatch: 'full',
  },
  {
    path: 'language-islands',
    redirectTo: 'live/events',
    pathMatch: 'full',
  },
  {
    path: 'business-profile',
    loadComponent: () =>
      import('../components/business-profile/business-profile.component').then(
        (m) => m.BusinessProfileComponent,
      ),
    title: 'Business Profile - HelloTalk',
  },
];
