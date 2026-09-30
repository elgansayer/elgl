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
    loadComponent: () =>
      import('../pages/chat-settings/chat-settings.component').then((m) => m.ChatSettingsComponent),
    title: 'Chat Settings - HelloTalk',
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
    loadComponent: () =>
      import('../components/create-group/create-group.component').then(
        (m) => m.CreateGroupComponent,
      ),
    title: 'Create Group - HelloTalk',
  },
  {
    path: 'communities',
    loadComponent: () =>
      import('../components/communities/communities.component').then((m) => m.CommunitiesComponent),
    title: 'Communities - HelloTalk',
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
    loadComponent: () =>
      import('../pages/settings/message-filter-settings/message-filter-settings.component').then(
        (m) => m.MessageFilterSettingsComponent,
      ),
    title: 'Message Filter Settings - HelloTalk',
  },
  {
    path: 'blocks',
    loadComponent: () =>
      import('../pages/block-management/block-management.component').then(
        (m) => m.BlockManagementComponent,
      ),
    title: 'Block Management - HelloTalk',
  },
];
