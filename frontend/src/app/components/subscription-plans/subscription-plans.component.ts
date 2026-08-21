import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, resource } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { RestorePurchasesButtonComponent } from '../restore-purchases-button/restore-purchases-button.component';
import { TranslatePipe } from '../../services/translate.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-subscription-plans',
  imports: [
    HlmButton,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    RestorePurchasesButtonComponent,
    TranslatePipe,
  ],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-surface-500 to-surface-600 py-8 sm:py-12 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-8 sm:mb-12">
          <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-text-primary mb-4">
            {{ 'subscription.plans.title' | t }}
          </h1>
          <p class="text-text-secondary text-sm sm:text-base lg:text-lg">
            {{ 'subscription.plans.subtitle' | t }}
          </p>
        </div>

        <div class="flex justify-center mb-8 sm:mb-10">
          <div class="bg-surface-200 rounded-full p-1 inline-flex items-center">
            <button
              hlmBtn
              (click)="billingInterval.set('month')"
              [class]="
                billingInterval() === 'month'
                  ? 'bg-vip text-on-fill shadow-lg'
                  : 'text-text-muted hover:text-text-primary'
              "
              class="px-4 sm:px-6 py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-200"
            >
              {{ 'subscription.plans.monthly' | t }}
            </button>
            <button
              hlmBtn
              (click)="billingInterval.set('year')"
              [class]="
                billingInterval() === 'year'
                  ? 'bg-vip text-on-fill shadow-lg'
                  : 'text-text-muted hover:text-text-primary'
              "
              class="px-4 sm:px-6 py-2 rounded-full font-medium text-xs sm:text-sm transition-all duration-200"
            >
              {{ 'subscription.plans.yearly' | t }}
              <span class="text-xs ms-1 text-success">{{
                'subscription.plans.saveAmount' | t
              }}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          @for (plan of plans(); track plan.id) {
            <div [class]="getPlanCardClass(plan)">
              @if (plan.badge_text) {
                <div class="absolute -top-3 inset-x-0 flex justify-center">
                  <span
                    class="bg-gradient-to-r from-vip to-accent text-on-fill text-xs font-bold px-4 py-1 rounded-full shadow-lg"
                  >
                    {{ plan.badge_text }}
                  </span>
                </div>
              }

              <div class="p-5 sm:p-6">
                <h3 class="text-lg sm:text-xl font-bold text-text-primary mb-2">{{ plan.name }}</h3>
                <p class="text-text-secondary text-xs sm:text-sm mb-6">{{ plan.description }}</p>

                <div class="mb-6">
                  <div class="flex items-baseline">
                    <span class="text-3xl sm:text-4xl font-bold text-text-primary">
                      {{ getDisplayPrice(plan) }}
                    </span>
                    <span class="text-text-secondary ms-2 text-sm">/{{ billingInterval() }}</span>
                  </div>
                  @if (billingInterval() === 'year' && plan.price_usd > 0) {
                    <p class="text-success text-sm mt-1">
                      {{ plan.price_ukp }} UKP / &#36;{{ plan.price_usd }} USD per month if paid
                      monthly
                    </p>
                  }
                </div>

                @if (plan.highlighted_benefits?.length) {
                  <div class="mb-6 space-y-2">
                    @for (benefit of plan.highlighted_benefits; track benefit) {
                      <div class="flex items-start gap-2">
                        <span class="text-vip mt-0.5 flex-shrink-0">✦</span>
                        <span class="text-text-secondary text-xs sm:text-sm">{{ benefit }}</span>
                      </div>
                    }
                  </div>
                }

                <ul class="space-y-2 sm:space-y-3 mb-8">
                  @for (feature of plan.features; track feature) {
                    <li class="flex items-start gap-2">
                      <span class="text-success mt-0.5 flex-shrink-0">✓</span>
                      <span class="text-text-secondary text-xs sm:text-sm">{{ feature }}</span>
                    </li>
                  }
                </ul>

                @if (plan.price_usd === 0) {
                  <app-button-secondary [disabled]="true" customClass="w-full">
                    {{ 'subscription.plans.currentPlan' | t }}
                  </app-button-secondary>
                } @else {
                  <app-button-primary
                    (clicked)="onSelectPlan(plan)"
                    [disabled]="loading()"
                    customClass="w-full"
                  >
                    @if (loading()) {
                      {{ 'subscription.plans.processing' | t }}
                    } @else {
                      {{ 'subscription.plans.getStarted' | t }}
                    }
                  </app-button-primary>
                }
              </div>
            </div>
          }
        </div>
      </div>
      <div class="mt-6 text-center">
        <p class="text-xs text-text-secondary mb-2">
          {{ 'subscription.plans.restorePrompt' | t }}
        </p>
        <app-restore-purchases-button />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SubscriptionPlansComponent {
  private plansService = inject(SubscriptionPlansService);
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly billingInterval = signal<'month' | 'year'>('month');
  readonly loading = signal(false);

  private plansLoader = resource({
    loader: async () => {
      try {
        const plans = await this.plansService.getAllPlans();
        this.plans.set(plans);
      } catch (err) {
        console.error('Failed to load plans', err);
      }
    },
  });

  getPlanCardClass(plan: SubscriptionPlan): string {
    const base = 'relative rounded-2xl border transition-all duration-300';
    if (plan.is_popular) {
      return `${base} border-vip bg-surface-200/80 shadow-xl shadow-vip/10 scale-105`;
    }
    return `${base} border-surface-100 bg-surface-200/50 hover:border-surface-200`;
  }

  getDisplayPrice(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) return 'Free';
    if (this.billingInterval() === 'year') {
      return '£50 / $63 USD';
    }
    return `£${plan.price_ukp} / $${plan.price_usd} USD`;
  }

  async onSelectPlan(plan: SubscriptionPlan): Promise<void> {
    if (plan.price_usd === 0) return;

    this.loading.set(true);

    try {
      const response = await firstValueFrom(
        this.http.post<{ sessionUrl: string; sessionId: string }>(
          `${environment.apiUrl}/monetisation/create-checkout-session`,
          { planId: plan.id, interval: this.billingInterval() },
        ),
      );
      window.location.href = response.sessionUrl;
    } catch (err) {
      console.error('Failed to create checkout session', err);
      this.loading.set(false);
    }
  }
}
