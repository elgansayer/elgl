import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { SrsTourService } from '../../services/srs-tour.service';

@Component({
  selector: 'app-srs-tour-trigger',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (!tourService.hasCompletedTour()) {
      <button
        type="button"
        (click)="tourService.startTour()"
        class="app-button-primary ps-4 pe-4 pt-2 pb-2 text-xs font-bold"
        [attr.aria-label]="'srsTour.startAriaLabel' | t"
      >
        {{ 'srsTour.startBtn' | t }}
      </button>
    }
  `,
})
export class SrsTourTriggerComponent {
  readonly tourService = inject(SrsTourService);
}