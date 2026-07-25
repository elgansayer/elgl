import { Component, inject, signal, computed, OnInit } from '@angular/core';

import { RouterLink } from '@angular/router';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';

@Component({
  selector: 'app-vip-subscription',
  standalone: true,
  imports: [RouterLink, AppButtonPrimaryComponent, AppGradientButtonComponent],
  templateUrl: './vip-subscription.component.html',
  styleUrls: ['./vip-subscription.component.scss'],
})
export class VipSubscriptionComponent implements OnInit {
  private subscriptionPlansService = inject(SubscriptionPlansService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly popularPlan = computed(() => this.plans().find((p) => p.is_popular));

  readonly freePlan = computed(() => this.plans().find((p) => p.id === 'free'));

  readonly paidPlans = computed(() => this.plans().filter((p) => p.id !== 'free'));

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    this.subscriptionPlansService.getAllPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load subscription plans:', err);
        this.error.set('Failed to load subscription plans. Please try again later.');
        this.loading.set(false);
      },
    });
  }

  getPriceDisplay(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) {
      return 'Free';
    }
    return `$${plan.price_usd}/mo`;
  }

  getPlanIcon(planId: string): string {
    switch (planId) {
      case 'free':
        return '🌟';
      case 'consumer_8_ukp_10_usd':
        return '👑';
      case 'developer_20_ukp_26_usd':
        return '⚡';
      default:
        return '📋';
    }
  }

  getFeatureCategories(): Array<{ name: string; getValue: (plan: SubscriptionPlan) => boolean }> {
    return [
      { name: 'Target Languages', getValue: (p) => p.id !== 'free' || true },
      { name: 'AI Translations', getValue: (p) => p.id !== 'free' },
      { name: 'Voice & Video Messages', getValue: (p) => p.id !== 'free' },
      {
        name: 'Location Spoofing',
        getValue: (p) => p.id === 'consumer_8_ukp_10_usd' || p.id === 'developer_20_ukp_26_usd',
      },
      { name: 'Priority Search', getValue: (p) => p.id !== 'free' },
      { name: 'Profile Views', getValue: (p) => p.id !== 'free' },
      { name: 'Ad-Free', getValue: (p) => p.id !== 'free' },
      { name: 'API Access', getValue: (p) => p.id === 'developer_20_ukp_26_usd' },
      { name: 'Developer Analytics', getValue: (p) => p.id === 'developer_20_ukp_26_usd' },
      { name: 'Diagnostic Logs', getValue: (p) => p.id === 'developer_20_ukp_26_usd' },
    ];
  }

  getAllFeatures(): string[] {
    const featureSet = new Set<string>();
    this.plans().forEach((plan) => {
      plan.features.forEach((feature) => featureSet.add(feature));
    });
    return Array.from(featureSet);
  }

  planHasFeature(plan: SubscriptionPlan, feature: string): boolean {
    return plan.features.includes(feature);
  }

  scrollToPlans(): void {
    const element = document.getElementById('plans');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onSubscribe(planId: string): void {
    // Navigate to checkout or show subscription modal
    window.location.href = `/subscription?plan=${planId}`;
  }
}
