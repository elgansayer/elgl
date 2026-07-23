import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SubscriptionPlan, SubscriptionPlansService } from '../../services/subscription-plans.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-vip-subscription',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './vip-subscription.component.html',
  styleUrls: ['./vip-subscription.component.scss'],
})
export class VipSubscriptionComponent implements OnInit {
  private subscriptionPlansService = inject(SubscriptionPlansService);
  private i18nService = inject(I18nService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly selectedPlanId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentLang = this.i18nService.currentLang;

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

  getPriceDisplay(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) {
      return 'Free';
    }
    const currencySymbol = plan.currency === 'USD' ? '$' : '£';
    const price = plan.currency === 'USD' ? plan.price_usd : plan.price_ukp;
    return `${currencySymbol}${price}/${plan.interval}`;
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
    if (lower.includes('location') || lower.includes('spoof')) return '📍';
    if (lower.includes('global') || lower.includes('discovery')) return '🌍';
    if (lower.includes('ad-free')) return '🚫';
    if (lower.includes('api')) return '🔌';
    if (lower.includes('analytics')) return '📊';
    if (lower.includes('support')) return '💬';
    if (lower.includes('early') || lower.includes('beta')) return '🔬';
    if (lower.includes('export')) return '📤';
    if (lower.includes('custom')) return '⚙️';
    return '✅';
  }

  subscribe(plan: SubscriptionPlan): void {
    if (plan.price_usd === 0) {
      window.location.href = '/dashboard';
      return;
    }
    console.log(`Subscribing to plan: ${plan.id}`);
    // TODO: Implement Stripe checkout redirect
  }
}
