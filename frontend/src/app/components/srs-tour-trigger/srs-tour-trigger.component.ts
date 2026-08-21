import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { SrsTourService } from '../../services/srs-tour.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-srs-tour-trigger',
  standalone: true,
  imports: [TranslatePipe, AppButtonPrimaryComponent],
  template: `
    @if (!tourService.hasCompletedTour()) {
      <app-button-primary
        (clicked)="tourService.startTour()"
        customClass="ps-4 pe-4 pt-2 pb-2 text-xs"
        [attr.aria-label]="'srsTour.startAriaLabel' | t"
      >
        {{ 'srsTour.startBtn' | t }}
      </app-button-primary>
    }
  `,
})
export class SrsTourTriggerComponent {
  readonly tourService = inject(SrsTourService);
}
