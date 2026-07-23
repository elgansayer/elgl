import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SubscriptionPlansService, SubscriptionPlan } from '../../services/subscription-plans.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-subscription-plans',
  standalone: true,
  imports: [CommonModule, AppButtonPrimaryComponent, AppButtonSecondaryComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 py-12 px-4">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-white mb-4">Choose Your Plan</h1>
          <p class="text-slate-300 text-lg">Unlock premium features to accelerate your language learning</p>
        </div>

        <!-- Billing Toggle -->
        <div class="flex justify-center mb-10">
          <div class="bg-slate-800 rounded-full p-1 inline-flex items-center">
            <button
              (click)="billingInterval.set('month')"
              [class]="billingInterval() === 'month' 
                ? 'bg-purple-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'"
              class="px-6 py-2 rounded-full font-medium transition-all duration-200"
            >
              Monthly
            </button>
            <button
              (click)="billingInterval.set('year')"
              [class]="billingInterval() === 'year' 
                ? 'bg-purple-600 text-white shadow-lg' 
                : 'text-slate-400 hover:text-white'"
              class="px-6 py-2 rounded-full font-medium transition-all duration-200"
            >
              Yearly
              <span class="text-xs ml-1 text-green-400">Save 48%</span>
            </button>
          </div>
        </div>

        <!-- Plans Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          @for (plan of plans(); track plan.id) {
            <div
              [class]="getPlanCardClass(plan)"
            >
              @if (plan.badge_text) {
                <div class="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span class="bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow-lg">
                    {{ plan.badge_text }}
                  </span>
                </div>
              }

              <div class="p-6">
                <h3 class="text-xl font-bold text-white mb-2">{{ plan.name }}</h3>
                <p class="text-slate-400 text-sm mb-6">{{ plan.description }}</p>

                <!-- Price -->
                <div class="mb-6">
                  <div class="flex items-baseline">
                    <span class="text-4xl font-bold text-white">
                      {{ getDisplayPrice(plan) }}
                    </span>
                    <span class="text-slate-400 ml-2">/{{ billingInterval() }}</span>
                  </div>
                  @if (billingInterval() === 'year' && plan.price_usd > 0) {
                    <p class="text-green-400 text-sm mt-1">
                      ${{ plan.price_usd }}/month if paid monthly
                    </p>
                  }
                </div>

                <!-- Highlighted Benefits -->
                @if (plan.highlighted_benefits?.length) {
                  <div class="mb-6 space-y-2">
                    @for (benefit of plan.highlighted_benefits; track benefit) {
                      <div class="flex items-start gap-2">
                        <span class="text-purple-400 mt-0.5">✦</span>
                        <span class="text-slate-300 text-sm">{{ benefit }}</span>
                      </div>
                    }
                  </div>
                }

                <!-- Features List -->
                <ul class="space-y-3 mb-8">
                  @for (feature of plan.features; track feature) {
                    <li class="flex items-start gap-2">
                      <span class="text-green-400 mt-0.5">✓</span>
                      <span class="text-slate-300 text-sm">{{ feature }}</span>
                    </li>
                  }
                </ul>

                <!-- CTA Button -->
                @if (plan.price_usd === 0) {
                  <app-button-secondary
                    [disabled]="true"
                    customClass="w-full"
                  >
                    Current Plan
                  </app-button-secondary>
                } @else {
                  <app-button-primary
                    (clicked)="onSelectPlan(plan)"
                    [disabled]="loading()"
                    customClass="w-full"
                  >
                    @if (loading()) {
                      Processing...
                    } @else {
                      Get Started
                    }
                  </app-button-primary>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class SubscriptionPlansComponent {
  private plansService = inject(SubscriptionPlansService);
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly billingInterval = signal<'month' | 'year'>('month');
  readonly loading = signal(false);

  constructor() {
    this.loadPlans();
  }

  private loadPlans(): void {
    this.plansService.getAllPlans().subscribe({
      next: (plans) => this.plans.set(plans),
      error: (err) => console.error('Failed to load plans', err),
    });
  }

  getPlanCardClass(plan: SubscriptionPlan): string {
    const base = 'relative rounded-2xl border transition-all duration-300';
    if (plan.is_popular) {
      return `${base} border-purple-500 bg-slate-800/80 shadow-xl shadow-purple-500/10 scale-105`;
    }
    return `${base} border-slate-700 bg-slate-800/50 hover:border-slate-600`;
  }

  getDisplayPrice(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) return 'Free';
    if (this.billingInterval() === 'year') {
      // Yearly price: £50 / $63 USD
      return '£50';
    }
    // Monthly price: £8 / $10 USD
    return '£8';
  }

  onSelectPlan(plan: SubscriptionPlan): void {
    if (plan.price_usd === 0) return;
    
    this.loading.set(true);
    
    // Map plan to interval type
    const planType = this.billingInterval() === 'year' ? 'yearly' : 'monthly';
    
    this.http.post<{ sessionUrl: string; sessionId: string }>(
      `${environment.apiUrl}/stripe/create-checkout-session`,
      { planType }
    ).subscribe({
      next: (response) => {
        // Redirect to Stripe Checkout
        window.location.href = response.sessionUrl;
      },
      error: (err) => {
        console.error('Failed to create checkout session', err);
        this.loading.set(false);
      },
    });
  }
}
