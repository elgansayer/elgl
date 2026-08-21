import { Component, computed, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { ConfirmService } from '../../services/confirm.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      @if (confirmService.confirmState(); as state) {
        <hlm-dialog-content
          *hlmDialogPortal
          [showCloseButton]="false"
          class="w-full max-w-sm space-y-5 rounded-sheet border border-surface-100 bg-surface-200 p-6 shadow-lift"
          aria-labelledby="confirm-message"
        >
          <p id="confirm-message" class="text-sm font-medium leading-relaxed text-text-primary">
            {{ state.message }}
          </p>
          <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="touch"
              class="w-full sm:w-auto"
              (click)="confirmService.dismiss(false)"
            >
              {{ 'common.cancel' | t }}
            </button>
            <button
              hlmBtn
              type="button"
              size="touch"
              class="w-full sm:w-auto"
              (click)="confirmService.dismiss(true)"
            >
              {{ 'common.confirm' | t }}
            </button>
          </div>
        </hlm-dialog-content>
      }
    </hlm-dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly confirmService = inject(ConfirmService);
  readonly dialogState = computed<HlmDialogState>(() =>
    this.confirmService.confirmState() ? 'open' : 'closed',
  );

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.confirmService.confirmState()) {
      this.confirmService.dismiss(false);
    }
  }
}
