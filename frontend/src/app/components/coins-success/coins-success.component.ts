import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-success',
  imports: [TranslatePipe, RouterLink, ...HlmButtonImports],
  template: `
    <div
      class="flex min-h-screen items-center justify-center bg-surface-500 px-4 py-6 sm:px-6 sm:py-10 lg:px-8"
    >
      <div
        class="w-full max-w-md rounded-card border border-surface-100 bg-surface-200 px-5 py-8 text-center shadow-card sm:px-8 sm:py-10 lg:px-10 lg:py-12"
      >
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">
          {{ status() === 'failed' ? '😕' : '🎉' }}
        </div>
        <h1 class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ (status() === 'failed' ? 'coinsSuccess.failureTitle' : 'coinsSuccess.title') | t }}
        </h1>
        <p class="mb-8 text-sm text-text-secondary sm:text-base" aria-live="polite" role="status">
          {{
            (status() === 'pending'
              ? 'coinsSuccess.pending'
              : status() === 'failed'
                ? 'coinsSuccess.failureMessage'
                : 'coinsSuccess.message'
            ) | t
          }}
        </p>
        <a class="w-full sm:w-auto" hlmBtn size="touch" routerLink="/dashboard">
          {{ 'coinsSuccess.dashboardBtn' | t }}
        </a>
      </div>
    </div>
  `,
})
export class CoinsSuccessComponent {
  private route = inject(ActivatedRoute);
  private economyStore = inject(EconomyStore);

  readonly status = signal<'pending' | 'confirmed' | 'failed'>('pending');

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    const params = await firstValueFrom(this.route.queryParams);
    const sessionId = params['session_id'];
    if (!sessionId) {
      this.status.set('failed');
      return;
    }
    const confirmed = await this.economyStore.confirmCoinPurchase(sessionId);
    this.status.set(confirmed ? 'confirmed' : 'failed');
  }
}
