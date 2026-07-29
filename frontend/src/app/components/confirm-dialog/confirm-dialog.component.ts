import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslatePipe],
  template: `
    @if (confirmService.confirmState(); as state) {
      <div
        class="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-message"
      >
        <div
          class="bg-[#121212] rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-neutral-700 space-y-5"
        >
          <p
            id="confirm-message"
            class="text-white text-sm font-medium leading-relaxed"
          >
            {{ state.message }}
          </p>
          <div class="flex gap-3 justify-end">
            <button
              (click)="confirmService.dismiss(false)"
              class="px-5 py-2.5 rounded-xl bg-neutral-800 text-neutral-300 text-sm font-bold hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
            >
              {{ 'common.cancel' | t }}
            </button>
            <button
              (click)="confirmService.dismiss(true)"
              class="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {{ 'common.confirm' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmService);
}
