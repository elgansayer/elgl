import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-cancel',
  imports: [TranslatePipe],
  template: `
    <main
      class="min-h-screen bg-[#121212] flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md w-full" role="status" aria-live="polite">
        <div class="text-5xl sm:text-6xl mb-6" aria-hidden="true">😕</div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-4">{{ 'coinsCancel.title' | t }}</h1>
        <p class="text-neutral-400 mb-8 text-sm sm:text-base">{{ 'coinsCancel.message' | t }}</p>
        <button
          (click)="goBack()"
          class="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200 text-sm sm:text-base"
          [attr.aria-label]="'coinsCancel.backBtn' | t"
        >
          {{ 'coinsCancel.backBtn' | t }}
        </button>
      </div>
    </main>
  `,
})
export class CoinsCancelComponent {
  private router = inject(Router);

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
