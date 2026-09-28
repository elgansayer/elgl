import { Routes } from '@angular/router';

export const chatRoutes: Routes = [
  {
    path: 'chat',
    loadComponent: () =>
      import('../components/chat-list/chat-list.component').then((m) => m.ChatListComponent),
  },
  {
    path: 'chat/:id',
    loadComponent: () =>
      import('../pages/chat/chat-room-page.component').then((m) => m.ChatRoomPageComponent),
  },
  {
    path: 'chat-settings',
    redirectTo: 'settings/chat',
    pathMatch: 'full',
  },
  {
    path: 'groups',
    loadComponent: () =>
      import('../components/groups-discovery/groups-discovery.component').then(
        (m) => m.GroupsDiscoveryComponent,
      ),
    title: 'Groups Discovery - HelloTalk',
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
    path: 'join',
    loadComponent: () =>
      import('../pages/join-group/join-group.component').then((m) => m.JoinGroupComponent),
    title: 'Join Group - HelloTalk',
  },
  {
    path: 'join/:code',
    loadComponent: () =>
      import('../pages/join-group/join-group.component').then((m) => m.JoinGroupComponent),
    title: 'Join Group - HelloTalk',
  },
  {
    path: 'message-filters',
    redirectTo: 'settings/message-filters',
    pathMatch: 'full',
  },
  {
    path: 'blocks',
    redirectTo: 'settings/blocks',
    pathMatch: 'full',
  },
];
