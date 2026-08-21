import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-subscription-cancel',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-surface-600 to-surface-500 px-4">
      <div class="w-full max-w-md text-center">
        <div class="mb-6 text-5xl sm:text-6xl" aria-hidden="true">😕</div>
        <h1 class="mb-4 text-2xl font-bold text-text-primary sm:text-3xl">
          {{ 'subscription.cancel.title' | t }}
        </h1>
        <p class="mb-8 text-sm text-text-secondary sm:text-base">
          {{ 'subscription.cancel.message' | t }}
        </p>
        <button hlmBtn type="button" size="touch" (click)="goBack()">
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
