import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';
import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';
import { MonetisationService } from '../../services/monetisation.service';
import { SubscriptionPlansService, SubscriptionPlan } from '../../services/subscription-plans.service';
@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [
    CommonModule,
    AppCardComponent,
    AppButtonPrimaryComponent,
    AppPillComponent,
    AppGradientButtonComponent,
  ],
  template: `
    <div class="min-h-screen bg-surface-600 py-12 px-4">
      <div class="max-w-6xl mx-auto">
        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-4xl font-extrabold text-text-primary mb-3">
            Choose Your Plan
          </h1>
          <p class="text-lg text-text-secondary max-w-2xl mx-auto">
            Unlock premium features to accelerate your language learning journey.
          </p>
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="flex justify-center items-center py-20">
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        }

        <!-- Error State -->
        @if (errorMessage()) {
          <app-card variant="outlined" customClass="max-w-md mx-auto border-red-500/30 bg-red-500/10">
            <div class="text-center py-4">
              <p class="text-red-400 font-semibold mb-2">Failed to load plans</p>
              <p class="text-text-secondary text-sm mb-4">{{ errorMessage() }}</p>
              <app-button-primary (clicked)="loadPlans()" size="sm">
                Try Again
              </app-button-primary>
            </div>
          </app-card>
        }

        <!-- Plans Grid -->
        @if (!isLoading() && !errorMessage()) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (plan of plans(); track plan.id) {
              <app-card
                [variant]="plan.is_popular ? 'elevated' : 'default'"
                [customClass]="plan.is_popular ? 'ring-2 ring-purple-500 relative' : ''"
              >
                <!-- Popular Badge -->
                @if (plan.is_popular) {
                  <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                    <app-pill label="Most Popular" colour="primary" size="sm" />
                  </div>
                }

                <div class="p-6 flex flex-col h-full">
                  <!-- Plan Name & Description -->
                  <div class="mb-6">
                    <h3 class="text-xl font-bold text-text-primary mb-1">{{ plan.name }}</h3>
                    <p class="text-sm text-text-secondary">{{ plan.description }}</p>
                  </div>

                  <!-- Price -->
                  <div class="mb-6">
                    <div class="flex items-baseline gap-1">
                      <span class="text-4xl font-extrabold text-text-primary">
                        {{ plan.currency === 'GBP' ? '£' : '$' }}{{ plan.currency === 'GBP' ? plan.price_ukp : plan.price_usd }}
                      </span>
                      <span class="text-text-secondary text-sm">/{{ plan.interval }}</span>
                    </div>
                  </div>

                  <!-- Features List -->
                  <ul class="space-y-3 mb-8 flex-1">
                    @for (feature of plan.features; track feature) {
                      <li class="flex items-start gap-2 text-sm text-text-secondary">
                        <span class="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                        <span>{{ feature }}</span>
                      </li>
                    }
                  </ul>

                  <!-- Subscribe Button -->
                  <app-gradient-button
                    [disabled]="subscribingPlanId() === plan.id"
                    [customClass]="'w-full'"
                    (clicked)="subscribe(plan.id)"
                  >
                    @if (subscribingPlanId() === plan.id) {
                      <span class="flex items-center gap-2">
                        <span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                        Redirecting...
                      </span>
                    } @else {
                      {{ plan.interval === 'month' ? 'Subscribe Monthly' : 'Subscribe Yearly' }}
                    }
                  </app-gradient-button>
                </div>
              </app-card>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class SubscriptionPageComponent implements OnInit {
  private readonly monetisationService = inject(MonetisationService);
  private readonly subscriptionPlansService = inject(SubscriptionPlansService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly subscribingPlanId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.subscriptionPlansService.getAllPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Unable to load subscription plans.');
        this.isLoading.set(false);
      },
    });
  }

  subscribe(planId: string): void {
    this.subscribingPlanId.set(planId);
    const plan = this.plans().find(p => p.id === planId);
    if (!plan) return;

    this.monetisationService.createCheckoutSession(planId, plan.interval).subscribe({
      next: (response) => {
        window.location.href = response.sessionUrl;
      },
      error: (err) => {
        this.subscribingPlanId.set(null);
        this.errorMessage.set(err.message || 'Failed to start checkout. Please try again.');
      },
    });
  }
}
