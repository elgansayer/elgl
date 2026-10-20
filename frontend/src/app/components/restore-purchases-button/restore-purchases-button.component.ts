import { Component, inject, output } from '@angular/core';

import {
  RestorePurchasesService,
  RestoreResult,
} from '../../services/restore-purchases.service';
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
      [ariaLabel]="'restore_purchases' | t"
      [attr.aria-busy]="restoreService.isRestoring()"
    >
      @if (restoreService.isRestoring()) {
        <span class="flex items-center gap-2">
          <svg
            class="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
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

    @if (restoreService.lastRestoreResult(); as result) {
      <p class="sr-only" role="status" aria-live="polite">{{ result.message }}</p>
    }
  `,
})
export class RestorePurchasesButtonComponent {
  readonly restoreService = inject(RestorePurchasesService);
  readonly restored = output<RestoreResult>();

  async onRestore(): Promise<void> {
    if (this.restoreService.isRestoring()) return;

    const result = await this.restoreService.restorePurchases();
    if (result.success) {
      this.restored.emit(result);
    }
  }
}
