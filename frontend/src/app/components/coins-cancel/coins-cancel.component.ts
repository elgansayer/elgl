import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-cancel',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <main
      class="flex min-h-screen items-center justify-center bg-surface-500 px-4"
      aria-labelledby="coins-cancel-title"
      aria-describedby="coins-cancel-message"
    >
      <div class="w-full max-w-md text-center">
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">😕</div>
        <h1 id="coins-cancel-title" class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ 'coinsCancel.title' | t }}
        </h1>
        <p id="coins-cancel-message" class="mb-8 text-sm text-text-secondary sm:text-base">
          {{ 'coinsCancel.message' | t }}
        </p>
        <button hlmBtn type="button" size="touch" (click)="goBack()">
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
