import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-subscription-success',
  imports: [TranslatePipe],
  template: `
    <div
      class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md w-full">
        <div class="text-5xl sm:text-6xl mb-6">🎉</div>
        <h1 class="text-2xl sm:text-3xl font-bold text-white mb-4">
          {{ 'subscription.success.title' | t }}
        </h1>
        <p class="text-slate-300 mb-8 text-sm sm:text-base">
          {{ 'subscription.success.message' | t }}
        </p>
        <button
          (click)="goToDashboard()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200 text-sm sm:text-base"
        >
          {{ 'subscription.success.dashboardBtn' | t }}
        </button>
      </div>
    </div>
  `,
})
export class SubscriptionSuccessComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await firstValueFrom(this.route.queryParams);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
