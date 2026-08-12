import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-subscription-cancel',
  imports: [TranslatePipe],
  template: `
    <div
      class="min-h-screen bg-gradient-to-b from-surface-600 to-surface-500 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md w-full">
        <div class="text-5xl sm:text-6xl mb-6">😕</div>
        <h1 class="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
          {{ 'subscription.cancel.title' | t }}
        </h1>
        <p class="text-text-secondary mb-8 text-sm sm:text-base">
          {{ 'subscription.cancel.message' | t }}
        </p>
        <button
          (click)="goBack()"
          class="bg-primary hover:bg-primary/90 text-on-fill font-bold py-3 px-8 rounded-2xl transition-all duration-200 text-sm sm:text-base"
        >
          {{ 'subscription.cancel.backBtn' | t }}
        </button>
      </div>
    </div>
  `,
})
export class SubscriptionCancelComponent {
  private router = inject(Router);

  goBack(): void {
    this.router.navigate(['/subscription']);
  }
}
