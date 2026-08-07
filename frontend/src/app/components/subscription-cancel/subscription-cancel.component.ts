import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-subscription-cancel',
  imports: [TranslatePipe],
  template: `
    <div
      class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md">
        <div class="text-6xl mb-6">😕</div>
        <h1 class="text-3xl font-bold text-white mb-4">{{ 'components.subscription-cancel.checkoutCancelled' | t }}</h1>
        <p class="text-slate-300 mb-8">
          {{ 'components.subscription-cancel.yourCheckoutWasCancelledN' | t }}
        </p>
        <button
          (click)="goBack()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200"
        >
          {{ 'components.subscription-cancel.backToPlans' | t }}
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
