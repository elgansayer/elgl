import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { SubscriptionService, SubscriptionDetails } from '../../services/subscription.service';
import { MonetisationService } from '../../services/monetisation.service';
import { SubscriptionPlansService, SubscriptionPlan } from '../../services/subscription-plans.service';

@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="max-w-xl mx-auto p-4 space-y-4">
      <!-- Page Title -->
      <h1 class="text-2xl font-bold">{{ 'subscription.title' | t }}</h1>

      @if (error()) {
        <div class="bg-red-500/10 border border-red-500 p-3 rounded-lg text-red-400">
          {{ 'subscription.loadError' | t }}
        </div>
      }

      <!-- Current subscription status -->
      @if (details()) {
        <div class="bg-surface rounded-xl p-4 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-semibold">{{ 'subscription.status' | t }}</span>
            <span [class]="details()!.isVip ? 'text-emerald-400' : 'text-slate-400'">
              {{ details()!.isVip ? ('subscription.active' | t) : ('subscription.inactive' | t) }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="font-semibold">{{ 'subscription.plan' | t }}</span>
            <span>{{ details()!.vipTier ?? ('subscription.free' | t) }}</span>
          </div>

          @if (details()!.isVip && details()!.email) {
            <div class="flex items-center justify-between">
              <span class="font-semibold">{{ 'subscription.email' | t }}</span>
              <span>{{ details()!.email }}</span>
            </div>
          }
        </div>
      }

      <!-- Available plans for upgrade/downgrade -->
      @if (plans()) {
        <div class="space-y-3">
          <h2 class="text-lg font-semibold">{{ 'subscription.availablePlans' | t }}</h2>

          @for (plan of plans()!; track plan.id) {
            <div class="bg-surface rounded-xl p-4 flex items-center justify-between">
              <div class="flex-1">
                <div class="font-semibold">{{ plan.name }}</div>
                <div class="text-sm text-slate-400">{{ plan.description }}</div>
              </div>
              <div class="text-end me-3">
                <div class="text-sm">
                  {{ plan.price_ukp }} UKP / ${{ plan.price_usd }} USD
                </div>
                @if (plan.interval === 'year') {
                  <span class="text-xs text-emerald-400">{{ 'subscription.perYear' | t }}</span>
                } @else {
                  <span class="text-xs text-slate-400">{{ 'subscription.perMonth' | t }}</span>
                }
              </div>
              <button
                (click)="changePlan(plan.id, plan.interval)"
                [disabled]="changingPlanId() === plan.id"
                class="btn btn-primary"
              >
                @if (changingPlanId() === plan.id) {
                  {{ 'subscription.processing' | t }}
                } @else {
                  {{ (currentPlanId() === plan.id ? 'subscription.currentPlan' : 'subscription.select') | t }}
                }
              </button>
            </div>
          }
        </div>
      }

      @if (details()?.isVip) {
        <button
          (click)="onCancel()"
          [disabled]="cancelling()"
          class="btn btn-danger w-full mt-3"
        >
          {{ cancelling() ? ('subscription.cancelling' | t) : ('subscription.cancelButton' | t) }}
        </button>
      }
    </div>
  `,
})
export class MySubscriptionComponent {
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly monetisationService = inject(MonetisationService);
  private readonly plansService = inject(SubscriptionPlansService);

  protected readonly details = signal<SubscriptionDetails | null>(null);
  protected readonly plans = signal<SubscriptionPlan[] | null>(null);
  protected readonly error = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly changingPlanId = signal<string | null>(null);

  protected readonly currentPlanId = computed(() => {
    const tier = this.details()?.vipTier;
    if (!tier) return null;
    const allPlans = this.plans();
    if (!allPlans) return null;
    const matched = allPlans.find(
      (p) => p.name.toLowerCase() === tier.toLowerCase(),
    );
    return matched ? matched.id : null;
  });

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    // Subscription details
    this.subscriptionService.getSubscriptionDetails().subscribe({
      next: (data) => {
        this.details.set(data);
        this.error.set(false);
      },
      error: () => this.error.set(true),
    });

    // Available subscription plans
    this.plansService.getAllPlans().then(
      (list) => {
        this.plans.set(list);
      },
      () => {
        // silently ignore plan fetch failure
      },
    );
  }

  protected changePlan(planId: string, interval: string): void {
    if (this.changingPlanId() === planId) return;
    this.changingPlanId.set(planId);

    this.monetisationService
      .createCheckoutSession(planId, interval as 'month' | 'year')
      .then((resp) => {
        if (resp.sessionUrl) {
          window.location.href = resp.sessionUrl;
        } else {
          this.changingPlanId.set(null);
        }
      })
      .catch(() => this.changingPlanId.set(null));
  }

  protected onCancel(): void {
    this.cancelling.set(true);
    this.subscriptionService.cancelSubscription().subscribe({
      next: () => {
        this.cancelling.set(false);
        this.loadData();
      },
      error: () => {
        this.cancelling.set(false);
      },
    });
  }
}
