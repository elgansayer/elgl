import { Routes } from '@angular/router';

export const mediaRoutes: Routes = [
  {
    path: 'audio-rooms',
    redirectTo: 'rooms/audio',
    pathMatch: 'full',
  },
  {
    path: 'rooms/audio',
    loadComponent: () =>
      import('../components/audio-room/audio-room.component').then((m) => m.AudioRoomComponent),
  },
  {
    path: 'classrooms',
    redirectTo: 'rooms/video',
    pathMatch: 'full',
  },
  {
    path: 'rooms/video',
    loadComponent: () =>
      import('../components/classrooms-marketplace/classrooms-marketplace').then(
        (m) => m.ClassroomsMarketplace,
      ),
    title: 'Video Classrooms - HelloTalk',
  },
  {
    path: 'video-call',
    redirectTo: 'calls/video',
    pathMatch: 'full',
  },
  {
    path: 'calls/video',
    loadComponent: () =>
      import('../components/video-call/video-call.component').then((m) => m.VideoCallComponent),
  },
  {
    path: 'call-logs',
    redirectTo: 'calls/logs',
    pathMatch: 'full',
  },
  {
    path: 'calls/logs',
    loadComponent: () =>
      import('../pages/call-logs/call-logs.component').then((m) => m.CallLogsComponent),
    title: 'Call Logs - HelloTalk',
  },
  {
    path: 'active-call',
    redirectTo: 'calls/active',
    pathMatch: 'full',
  },
  {
    path: 'calls/active',
    loadComponent: () =>
      import('../components/active-call/active-call.component').then((m) => m.ActiveCallComponent),
    title: 'Active Call - HelloTalk',
  },
  {
    path: 'voiceroom-notes/:roomId',
    redirectTo: 'rooms/audio/:roomId/notes',
    pathMatch: 'full',
  },
  {
    path: 'rooms/audio/:roomId/notes',
    loadComponent: () =>
      import('../components/voiceroom-notes/voiceroom-notes.component').then(
        (m) => m.VoiceroomNotesComponent,
      ),
    title: 'Voice Room Notes - HelloTalk',
  },
  {
    path: 'preview/room/:id',
    redirectTo: 'rooms/preview/:id',
    pathMatch: 'full',
  },
  {
    path: 'rooms/preview/:id',
    loadComponent: () =>
      import('../pages/voiceroom-preview/voiceroom-preview.component').then(
        (m) => m.VoiceroomPreviewComponent,
      ),
  },
  {
    path: 'host-dashboard',
    loadComponent: () =>
      import('../components/host-dashboard/host-dashboard.component').then(
        (m) => m.HostDashboardComponent,
      ),
    title: 'Host Dashboard - HelloTalk',
  },
];
