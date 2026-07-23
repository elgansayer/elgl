import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SubscriptionPlansService, SubscriptionPlan } from '../../services/subscription-plans.service';

@Component({
  selector: 'app-vip-subscription',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vip-subscription.component.html',
  styleUrls: ['./vip-subscription.component.scss'],
})
export class VipSubscriptionComponent implements OnInit {
  private subscriptionPlansService = inject(SubscriptionPlansService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly selectedPlanId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly billingInterval = signal<'month' | 'year'>('month');

  ngOnInit(): void {
    this.loadPlans();
  }

  private loadPlans(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.subscriptionPlansService.getAllPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load subscription plans. Please try again.');
        this.isLoading.set(false);
        console.error('Error loading subscription plans:', err);
      },
    });
  }

  selectPlan(planId: string): void {
    this.selectedPlanId.set(planId);
  }

  getPopularPlan(): SubscriptionPlan | undefined {
    return this.plans().find((p) => p.is_popular);
  }

  getNonFreePlans(): SubscriptionPlan[] {
    return this.plans().filter((p) => p.id !== 'free');
  }

  getFreePlan(): SubscriptionPlan | undefined {
    return this.plans().find((p) => p.id === 'free');
  }

  getPriceDisplay(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) return 'Free';
    return `$${plan.price_usd}/mo`;
  }

  getPriceUkpDisplay(plan: SubscriptionPlan): string {
    if (plan.price_ukp === 0) return 'Free';
    return `£${plan.price_ukp}/mo`;
  }

  getPlanIcon(planId: string): string {
    switch (planId) {
      case 'free':
        return '🌟';
      case 'consumer_8_ukp_10_usd':
        return '👑';
      case 'developer_20_ukp_26_usd':
        return '🚀';
      default:
        return '📋';
    }
  }

  getPlanColor(planId: string): string {
    switch (planId) {
      case 'free':
        return 'from-slate-500 to-slate-600';
      case 'consumer_8_ukp_10_usd':
        return 'from-amber-500 to-orange-600';
      case 'developer_20_ukp_26_usd':
        return 'from-purple-500 to-indigo-600';
      default:
        return 'from-blue-500 to-blue-600';
    }
  }

  getBenefitIcon(benefit: string): string {
    const lower = benefit.toLowerCase();
    if (lower.includes('unlimited') || lower.includes('ai')) return '🤖';
    if (lower.includes('location') || lower.includes('spoof') || lower.includes('mock')) return '📍';
    if (lower.includes('global') || lower.includes('discovery') || lower.includes('search')) return '🌍';
    if (lower.includes('ad-free') || lower.includes('ad')) return '🚫';
    if (lower.includes('api')) return '🔌';
    if (lower.includes('analytics') || lower.includes('diagnostic')) return '📊';
    if (lower.includes('support')) return '💬';
    if (lower.includes('early') || lower.includes('beta')) return '🔬';
    if (lower.includes('export') || lower.includes('bulk')) return '📤';
    if (lower.includes('custom') || lower.includes('integration')) return '⚙️';
    if (lower.includes('voice') || lower.includes('video')) return '🎤';
    if (lower.includes('profile') || lower.includes('visitor')) return '👤';
    if (lower.includes('priority')) return '⭐';
    return '✅';
  }

  subscribe(plan: SubscriptionPlan): void {
    if (plan.price_usd === 0) {
      window.location.href = '/discovery';
      return;
    }
    // TODO: Implement Stripe checkout redirect
    console.log(`Subscribing to plan: ${plan.id}`);
  }

  retry(): void {
    this.loadPlans();
  }
}
