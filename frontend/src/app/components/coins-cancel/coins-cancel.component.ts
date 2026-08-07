import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-cancel',
  imports: [TranslatePipe],
  template: `
    <main
      class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md" role="status" [attr.aria-label]="'coinsCancel.title' | t">
        <div class="text-6xl mb-6" aria-hidden="true">😕</div>
        <h1 class="text-3xl font-bold text-white mb-4">{{ 'coinsCancel.title' | t }}</h1>
        <p class="text-slate-300 mb-8">{{ 'coinsCancel.message' | t }}</p>
        <button
          (click)="goBack()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-slate-900"
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
