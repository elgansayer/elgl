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
    path: 'groups',
    loadComponent: () =>
      import('../components/groups-discovery/groups-discovery.component').then(
        (m) => m.GroupsDiscoveryComponent,
      ),
    title: 'Groups Discovery - HelloTalk',
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
];
