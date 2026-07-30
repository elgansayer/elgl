import { trigger, transition, style, animate, query, group } from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    group([
      query(':leave', [
        style({ opacity: 1, transform: 'translateX(0)' }),
        animate('0.25s cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateX(-30px)' })),
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, transform: 'translateX(30px)' }),
        animate('0.3s 0.1s cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'translateX(0)' })),
      ], { optional: true }),
    ]),
  ]),
]);
