import { Component, inject } from '@angular/core';

import { RestorePurchasesService } from '../../services/restore-purchases.service';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-restore-purchases-button',
  imports: [AppButtonSecondaryComponent, TranslatePipe],
  template: `
    <app-button-secondary
      [disabled]="restoreService.isRestoring()"
      [size]="'sm'"
      (clicked)="onRestore()"
      [customClass]="'w-full justify-center text-xs'"
    >
      @if (restoreService.isRestoring()) {
        <span class="flex items-center gap-2">
          <svg
            class="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {{ 'restoring' | t }}
        </span>
      } @else {
        {{ 'restore_purchases' | t }}
      }
    </app-button-secondary>
  `,
})
export class RestorePurchasesButtonComponent {
  readonly restoreService = inject(RestorePurchasesService);

  async onRestore(): Promise<void> {
    await this.restoreService.restorePurchases();
  }
}
