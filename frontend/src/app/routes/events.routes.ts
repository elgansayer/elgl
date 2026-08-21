import { Routes } from '@angular/router';

export const eventDetailRoutes: Routes = [
  {
    path: 'events/calendar',
    loadComponent: () =>
      import('../components/events-calendar/events-calendar.component').then(
        (m) => m.EventsCalendarComponent,
      ),
    title: 'Event Calendar - HelloTalk',
  },
  {
    path: 'events/:id',
    loadComponent: () =>
      import('../components/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
    title: 'Event - HelloTalk',
  },
];
