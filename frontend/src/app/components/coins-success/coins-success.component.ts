import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-success',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <main
      class="flex min-h-screen items-center justify-center bg-surface-500 px-4"
      aria-labelledby="coins-success-title"
      aria-describedby="coins-success-status"
    >
      <div class="w-full max-w-md text-center">
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">
          {{ status() === 'failed' ? '😕' : '🎉' }}
        </div>
        <h1 id="coins-success-title" class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ (status() === 'failed' ? 'coinsSuccess.failureTitle' : 'coinsSuccess.title') | t }}
        </h1>
        <p
          id="coins-success-status"
          class="mb-8 text-sm text-text-secondary sm:text-base"
          aria-live="polite"
          role="status"
        >
          {{
            (status() === 'pending'
              ? 'coinsSuccess.pending'
              : status() === 'failed'
                ? 'coinsSuccess.failureMessage'
                : 'coinsSuccess.message'
            ) | t
          }}
        </p>
        <button hlmBtn type="button" size="touch" (click)="goToDashboard()">
          {{ 'coinsSuccess.dashboardBtn' | t }}
        </button>
      </div>
    </main>
  `,
})
export class CoinsSuccessComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
