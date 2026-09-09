import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-cancel',
  imports: [TranslatePipe, RouterLink, ...HlmButtonImports],
  template: `
    <main
      class="flex min-h-screen items-center justify-center bg-surface-500 px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
      aria-labelledby="coins-cancel-title"
      aria-describedby="coins-cancel-message"
    >
      <div
        class="w-full max-w-md rounded-card border border-surface-100 bg-surface-200 px-5 py-8 text-center shadow-card sm:px-8 sm:py-10 lg:px-10 lg:py-12"
      >
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">😕</div>
        <h1 id="coins-cancel-title" class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ 'coinsCancel.title' | t }}
        </h1>
        <p id="coins-cancel-message" class="mb-8 text-sm text-text-secondary sm:text-base">
          {{ 'coinsCancel.message' | t }}
        </p>
        <a class="w-full sm:w-auto" hlmBtn size="touch" routerLink="/coin-economy">
          {{ 'coinsCancel.backBtn' | t }}
        </a>
      </div>
    </main>
  `,
})
export class CoinsCancelComponent {}
