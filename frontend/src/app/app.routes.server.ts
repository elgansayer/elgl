import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'active-call',
    renderMode: RenderMode.Client,
  },
  {
    path: 'video-call',
    renderMode: RenderMode.Client,
  },
  {
    path: 'audio-rooms/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'device-transfer',
    renderMode: RenderMode.Client,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
