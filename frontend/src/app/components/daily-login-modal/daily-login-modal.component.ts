import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-daily-login-modal',
  imports: [TranslatePipe],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn">
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-surface-100 text-center space-y-4"
      >
        <div class="text-6xl mb-2">🎁</div>
        <h3 class="text-2xl font-black text-text-primary">{{ 'daily_login_modal.title' | t }}</h3>
        <p class="text-text-secondary">{{ 'daily_login_modal.message' | t }}</p>
        <p class="text-amber-500 text-xl font-extrabold">{{ coins() }} coins</p>
        <button
          (click)="closed.emit()"
          class="w-full py-3 mt-4 bg-primary hover:bg-primary-dark text-white rounded-xl font-extrabold shadow transition-all"
        >
          {{ 'daily_login_modal.button' | t }}
        </button>
      </div>
    </div>
  `,
})
export class DailyLoginModalComponent {
  coins = input(0);
  closed = output<void>();
}
