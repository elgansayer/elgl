import { Routes } from '@angular/router';

export const mediaRoutes: Routes = [
  {
    path: 'audio-rooms',
    loadComponent: () =>
      import('../components/audio-room/audio-room.component').then((m) => m.AudioRoomComponent),
  },
  {
    path: 'classrooms',
    loadComponent: () =>
      import('../components/classrooms-marketplace/classrooms-marketplace').then(
        (m) => m.ClassroomsMarketplace,
      ),
    title: 'Video Classrooms - HelloTalk',
  },
  {
    path: 'video-call',
    loadComponent: () =>
      import('../components/video-call/video-call.component').then((m) => m.VideoCallComponent),
  },
  {
    path: 'call-logs',
    loadComponent: () =>
      import('../pages/call-logs/call-logs.component').then((m) => m.CallLogsComponent),
    title: 'Call Logs - HelloTalk',
  },
  {
    path: 'active-call',
    loadComponent: () =>
      import('../components/active-call/active-call.component').then((m) => m.ActiveCallComponent),
    title: 'Active Call - HelloTalk',
  },
  {
    path: 'voiceroom-notes/:roomId',
    loadComponent: () =>
      import('../components/voiceroom-notes/voiceroom-notes.component').then(
        (m) => m.VoiceroomNotesComponent,
      ),
    title: 'Voice Room Notes - HelloTalk',
  },
  {
    path: 'preview/room/:id',
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
