import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EconomyStore } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-coins-success',
  imports: [TranslatePipe],
  template: `
    <div
      class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md">
        <div class="text-6xl mb-6">{{ status() === 'failed' ? '😕' : '🎉' }}</div>
        <h1 class="text-3xl font-bold text-white mb-4">
          {{ (status() === 'failed' ? 'coinsSuccess.failureTitle' : 'coinsSuccess.title') | t }}
        </h1>
        <p class="text-slate-300 mb-8">
          {{
            (status() === 'pending'
              ? 'coinsSuccess.pending'
              : status() === 'failed'
                ? 'coinsSuccess.failureMessage'
                : 'coinsSuccess.message'
            ) | t
          }}
        </p>
        <button
          (click)="goToDashboard()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200"
        >
          {{ 'coinsSuccess.dashboardBtn' | t }}
        </button>
      </div>
    </div>
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
