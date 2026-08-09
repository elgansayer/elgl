import { trigger, transition, style, animate, query, group } from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    group([
      query(':leave', [
        style({ opacity: 1, transform: 'translateY(0)' }),
        animate('280ms ease-in', style({ opacity: 0, transform: 'translateY(-12px)' })),
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('320ms 80ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ], { optional: true }),
    ]),
  ]),
]);
