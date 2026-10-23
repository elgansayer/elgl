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
    redirectTo: 'chat/groups',
    pathMatch: 'full',
  },
  {
    path: 'chat/groups',
    loadComponent: () =>
      import('../components/groups-discovery/groups-discovery.component').then(
        (m) => m.GroupsDiscoveryComponent,
      ),
    title: 'Group Chats - HelloTalk',
  },
  {
    path: 'groups',
    redirectTo: 'chat/groups',
    pathMatch: 'full',
  },
  {
    path: 'community/groups/create',
    loadComponent: () =>
      import('../components/create-group/create-group.component').then(
        (m) => m.CreateGroupComponent,
      ),
    title: 'Create Group - HelloTalk',
  },
  {
    path: 'groups/create',
    redirectTo: 'community/groups/create',
    pathMatch: 'full',
  },
  {
    path: 'communities',
    redirectTo: 'chat/groups',
    pathMatch: 'full',
  },
  {
    path: 'community',
    redirectTo: 'chat/groups',
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
];
