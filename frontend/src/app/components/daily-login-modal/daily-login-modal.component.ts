import { Component, input, output, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-daily-login-modal',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm space-y-4 overflow-y-auto rounded-sheet border border-surface-100 bg-surface-200 p-5 text-center shadow-lift sm:p-6"
        [attr.aria-labelledby]="dialogTitleId"
      >
        <div class="text-6xl" aria-hidden="true">🎁</div>
        <h3 [id]="dialogTitleId" class="break-words text-2xl font-black text-text-primary">
          {{ 'dailyLoginModal.title' | t }}
        </h3>
        <p class="break-words text-text-secondary" aria-live="polite">
          {{ 'dailyLoginModal.body' | t: { coins: coins() } }}
        </p>
        <button
          hlmBtn
          hlmDialogClose
          type="button"
          size="touch"
          class="mt-4 w-full whitespace-normal text-center"
          [attr.aria-label]="
            ('dailyLoginModal.cta' | t) + ', ' + ('dailyLoginModal.body' | t: { coins: coins() })
          "
        >
          {{ 'dailyLoginModal.cta' | t }}
        </button>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class DailyLoginModalComponent {
  readonly coins = input(0);
  readonly open = input(true);
  readonly closed = output<void>();
  readonly dialogTitleId = 'daily-login-title-' + crypto.randomUUID();
  readonly dialogState = computed<HlmDialogState>(() => (this.open() ? 'open' : 'closed'));

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.open()) this.closed.emit();
  }
}
