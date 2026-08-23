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
      import('../components/chat-room/chat-room.component').then((m) => m.ChatRoomComponent),
  },
  {
    path: 'chat-settings',
    redirectTo: 'settings/chat',
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
