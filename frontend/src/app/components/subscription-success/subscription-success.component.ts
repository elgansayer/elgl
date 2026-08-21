import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-subscription-success',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-600 to-surface-500 px-4">
      <div class="w-full max-w-md text-center">
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">🎉</div>
        <h1 class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ 'subscription.success.title' | t }}
        </h1>
        <p class="mb-8 text-sm text-text-secondary sm:text-base">
          {{ 'subscription.success.message' | t }}
        </p>
        <button hlmBtn type="button" size="touch" (click)="goToDashboard()">
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
    void this.init();
  }

  private async init(): Promise<void> {
    await firstValueFrom(this.route.queryParams);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
