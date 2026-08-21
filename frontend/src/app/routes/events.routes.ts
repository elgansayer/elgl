import { Routes } from '@angular/router';

export const eventDetailRoutes: Routes = [
  {
    path: 'events/:id',
    loadComponent: () =>
      import('../components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
    title: 'Event - HelloTalk',
  },
];
