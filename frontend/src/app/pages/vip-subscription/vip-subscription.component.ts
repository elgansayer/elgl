import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppGradientButtonComponent } from '../../components/primitives/gradient-button/gradient-button.component';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

const EMPTY_PLANS: SubscriptionPlan[] = [];

@Component({
  selector: 'app-vip-subscription',
  imports: [
    HlmButton,
    RouterLink,
    AppButtonPrimaryComponent,
    AppGradientButtonComponent,
    TranslatePipe,
  ],
  templateUrl: './vip-subscription.component.html',
  styleUrls: ['./vip-subscription.component.scss'],
})
export class VipSubscriptionComponent {
  private subscriptionPlansService = inject(SubscriptionPlansService);
  private i18n = inject(I18nService);

  readonly plans = signal<SubscriptionPlan[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly popularPlan = computed(() => this.plans().find((p) => p.is_popular));

  readonly freePlan = computed(() => this.plans().find((p) => p.id === 'free'));

  readonly paidPlans = computed(() => this.plans().filter((p) => p.id !== 'free'));

  private reloadTrigger = signal(0);

  private plansLoader = resource({
    params: () => this.reloadTrigger(),
    loader: async () => {
      this.loading.set(true);
      this.error.set(null);
      try {
        const plans = await this.subscriptionPlansService.getAllPlans();
        this.plans.set(plans);
        return plans;
      } catch (err: unknown) {
        console.error('Failed to load subscription plans:', err);
        this.error.set(this.i18n.translate('vip.failedLoad'));
        return EMPTY_PLANS;
      } finally {
        this.loading.set(false);
      }
    },
    defaultValue: EMPTY_PLANS,
  });

  loadPlans(): void {
    this.reloadTrigger.update((v) => v + 1);
  }

  getPriceDisplay(plan: SubscriptionPlan): string {
    if (plan.price_usd === 0) {
      return this.i18n.translate('vip.freePrice');
    }
    return `$${plan.price_usd}/mo`;
  }

  getPlanIcon(planId: string): string {
    switch (planId) {
      case 'free':
        return '🌟';
      case 'consumer_8_ukp_10_usd':
        return '👑';
      case 'pro_12_ukp_15_usd':
        return '💎';
      case 'developer_20_ukp_26_usd':
        return '⚡';
      default:
        return '📋';
    }
  }

  getFeatureCategories(): Array<{ name: string; getValue: (plan: SubscriptionPlan) => boolean }> {
    const isVip = (p: SubscriptionPlan): boolean => p.id !== 'free';
    const isPro = (p: SubscriptionPlan): boolean => p.id === 'pro_12_ukp_15_usd';
    const isDeveloper = (p: SubscriptionPlan): boolean => p.id === 'developer_20_ukp_26_usd';
    return [
      { name: 'Target Languages', getValue: (p) => p.id !== 'free' || true },
      { name: 'AI Translations (Unlimited)', getValue: isVip },
      { name: 'Voice & Video Messages', getValue: isVip },
      {
        name: 'Location Spoofing',
        getValue: isVip,
      },
      { name: 'Advanced Visitor Logs', getValue: isPro },
      { name: 'Nearby Visibility Boost', getValue: isPro },
      { name: 'Priority Search', getValue: isVip },
      { name: 'Profile Views', getValue: isVip },
      { name: 'Ad-Free', getValue: isVip },
      { name: 'API Access', getValue: isDeveloper },
      { name: 'Developer Analytics', getValue: isDeveloper },
      { name: 'Diagnostic Logs', getValue: isDeveloper },
    ];
  }

  // ⚡ Bolt Performance Optimization:
  // Pre-calculate all available features once via computed signal instead of
  // executing the mapping logic during every template change detection cycle.
  readonly allFeatures = computed(() => {
    const featureSet = new Set<string>();
    this.plans().forEach((plan) => {
      plan.features.forEach((feature) => featureSet.add(feature));
    });
    return Array.from(featureSet);
  });

  // ⚡ Bolt Performance Optimization:
  // Cache the result of plan feature lookups to an O(1) hash map rather than
  // doing an O(n) `.includes` search per feature per plan on every render cycle.
  readonly planFeaturesMap = computed(() => {
    const map = new Map<string, Set<string>>();
    this.plans().forEach((plan) => {
      map.set(plan.id, new Set(plan.features));
    });
    return map;
  });

  scrollToPlans(): void {
    const element = document.getElementById('plans');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  onSubscribe(planId: string): void {
    window.location.href = `/subscription?plan=${planId}`;
  }
}
