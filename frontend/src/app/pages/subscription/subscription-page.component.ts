import { Component, inject, signal, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';
import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';
import { RestorePurchasesButtonComponent } from '../../components/restore-purchases-button/restore-purchases-button.component';
import { MonetisationService } from '../../services/monetisation.service';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';

const EMPTY_PLANS: SubscriptionPlan[] = [];
@Component({
  selector: 'app-subscription-page',
  imports: [
    TranslatePipe,
    AppCardComponent,
    AppButtonPrimaryComponent,

    AppPillComponent,
    AppGradientButtonComponent,
    RestorePurchasesButtonComponent,
  ],
  template: `
    <div class="min-h-screen bg-surface-600 py-12 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-4xl font-extrabold text-text-primary mb-3">
            {{ 'subscription.page.title' | t }}
          </h1>
          <p class="text-lg text-text-secondary max-w-2xl mx-auto">
            {{ 'subscription.page.subtitle' | t }}
          </p>
        </div>

        @if (isLoading()) {
          <div class="flex justify-center items-center py-20">
            <div
              class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
            ></div>
          </div>
        }

        @if (errorMessage()) {
          <app-card variant="outlined" customClass="max-w-md mx-auto border-danger/30 bg-danger/10">
            <div class="text-center py-4">
              <p class="text-danger font-semibold mb-2">{{ 'subscription.page.loadError' | t }}</p>
              <p class="text-text-secondary text-sm mb-4">{{ errorMessage() }}</p>
              <app-button-primary (clicked)="loadPlans()" size="sm">{{
                'subscription.page.retry' | t
              }}</app-button-primary>
            </div>
          </app-card>
        }

        @if (!isLoading() && !errorMessage()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (plan of plans(); track plan.id) {
              <app-card
                [variant]="plan.is_popular ? 'elevated' : 'default'"
                [customClass]="plan.is_popular ? 'ring-2 ring-primary relative' : ''"
              >
                @if (plan.is_popular) {
                  <div class="absolute -top-3 inset-x-0 flex justify-center">
                    <app-pill
                      [label]="'subscription.page.mostPopular' | t"
                      colour="primary"
                      size="sm"
                    />
                  </div>
                }

                <div class="p-6 flex flex-col h-full">
                  <div class="mb-6">
                    <h3 class="text-xl font-bold text-text-primary mb-1">{{ plan.name }}</h3>
                    <p class="text-sm text-text-secondary">{{ plan.description }}</p>
                  </div>

                  <div class="mb-6">
                    <div class="flex items-baseline gap-1">
                      <span class="text-4xl font-extrabold text-text-primary">
                        {{ plan.currency === 'GBP' ? '£' : '$'
                        }}{{ plan.currency === 'GBP' ? plan.price_ukp : plan.price_usd }}
                      </span>
                      <span class="text-text-secondary text-sm">/{{ plan.interval }}</span>
                    </div>
                  </div>

                  <ul class="space-y-3 mb-8 flex-1">
                    @for (feature of plan.features; track feature) {
                      <li class="flex items-start gap-2 text-sm text-text-secondary">
                        <span class="text-success mt-0.5 flex-shrink-0">✓</span>
                        <span>{{ feature }}</span>
                      </li>
                    }
                  </ul>

                  <app-gradient-button
                    [disabled]="subscribingPlanId() === plan.id"
                    [customClass]="'w-full'"
                    (clicked)="subscribe(plan.id)"
                  >
                    @if (subscribingPlanId() === plan.id) {
                      <span class="flex items-center gap-2">
                        <span
                          class="animate-spin inline-block w-4 h-4 border-2 border-on-fill border-t-transparent rounded-full"
                        ></span>
                        {{ 'subscription.page.redirecting' | t }}
                      </span>
                    } @else {
                      {{
                        plan.interval === 'month'
                          ? ('subscription.page.subscribeMonthly' | t)
                          : ('subscription.page.subscribeYearly' | t)
                      }}
                    }
                  </app-gradient-button>
                </div>
              </app-card>
            }
          </div>

          <div class="mt-8 text-center">
            <p class="text-xs text-text-secondary mb-2">
              {{ 'restore_purchases_description' | t }}
            </p>
            <app-restore-purchases-button />
          </div>
        }
      </div>
    </div>
  `,
})
export class SubscriptionPageComponent {
  private readonly monetisationService = inject(MonetisationService);
  private readonly subscriptionPlansService = inject(SubscriptionPlansService);
  private readonly i18n = inject(I18nService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly subscribingPlanId = signal<string | null>(null);

  private reloadTrigger = signal(0);

  private plansLoader = resource({
    params: () => this.reloadTrigger(),
    loader: async () => {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      try {
        const plans = await this.subscriptionPlansService.getAllPlans();
        this.plans.set(plans);
        return plans;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : this.i18n.translate('subscription.page.loadError');
        this.errorMessage.set(message);
        return EMPTY_PLANS;
      } finally {
        this.isLoading.set(false);
      }
    },
    defaultValue: EMPTY_PLANS,
  });

  loadPlans(): void {
    this.reloadTrigger.update((v) => v + 1);
  }

  async subscribe(planId: string): Promise<void> {
    this.subscribingPlanId.set(planId);
    const plan = this.plans().find((p) => p.id === planId);
    if (!plan) return;

    try {
      const response = await this.monetisationService.createCheckoutSession(planId, plan.interval);
      window.location.href = response.sessionUrl;
    } catch (err) {
      this.subscribingPlanId.set(null);
      const message =
        err instanceof Error ? err.message : this.i18n.translate('subscription.page.checkoutError');
      this.errorMessage.set(message);
    }
  }
}
