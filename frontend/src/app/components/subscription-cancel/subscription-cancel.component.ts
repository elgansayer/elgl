import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-subscription-cancel',
  imports: [],
  template: `
    <div
      class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center px-4"
    >
      <div class="text-center max-w-md">
        <div class="text-6xl mb-6">😕</div>
        <h1 class="text-3xl font-bold text-white mb-4">Checkout Cancelled</h1>
        <p class="text-slate-300 mb-8">
          Your checkout was cancelled. No charges were made. You can try again anytime.
        </p>
        <button
          (click)="goBack()"
          class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-2xl transition-all duration-200"
        >
          Back to Plans
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
