import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-daily-login-modal',
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="'dailyLoginModal.title' | t"
    >
      <div
        class="bg-[#1e1e1e] rounded-2xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full mx-auto shadow-2xl border border-neutral-700 text-center space-y-4"
      >
        <div class="text-5xl sm:text-6xl mb-2" aria-hidden="true">🎁</div>
        <h3 class="text-xl sm:text-2xl font-black text-white">
          {{ 'dailyLoginModal.title' | t }}
        </h3>
        <p class="text-neutral-300 text-sm sm:text-base">
          {{ 'dailyLoginModal.body' | t: { coins: coins() } }}
        </p>
        <button
          (click)="closed.emit()"
          class="w-full py-3 mt-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl font-extrabold shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {{ 'dailyLoginModal.cta' | t }}
        </button>
      </div>
    </div>
  `,
})
export class DailyLoginModalComponent {
  coins = input(0);
  closed = output<void>();
}
