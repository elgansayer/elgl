import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  SubscriptionService,
  SubscriptionDetails,
  SubscriptionInvoice,
} from '../../services/subscription.service';
import { MonetisationService } from '../../services/monetisation.service';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../../components/primitives/button-secondary/button-secondary.component';
import { AppEmptyStateComponent } from '../../components/primitives/empty-state/empty-state.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';
import { RestorePurchasesButtonComponent } from '../../components/restore-purchases-button/restore-purchases-button.component';

const EMPTY_INVOICES: SubscriptionInvoice[] = [];
const EMPTY_PLANS: SubscriptionPlan[] = [];

@Component({
  selector: 'app-my-subscription',
  imports: [
    HlmButton,
    TranslatePipe,
    AppCardComponent,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    AppEmptyStateComponent,
    AppPillComponent,
    RestorePurchasesButtonComponent,
  ],
  templateUrl: './my-subscription.component.html',
})
export class MySubscriptionComponent {
  private readonly location = inject(Location);
  private readonly subscriptionService = inject(SubscriptionService);
  private readonly monetisationService = inject(MonetisationService);
  private readonly plansService = inject(SubscriptionPlansService);
  private readonly i18n = inject(I18nService);

  protected readonly details = signal<SubscriptionDetails | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly cancelling = signal(false);
  protected readonly resuming = signal(false);
  protected readonly openingPortal = signal(false);
  protected readonly changingPlanId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);

  private readonly detailsResource = resource({
    loader: async () => {
      this.loading.set(true);
      this.error.set(false);
      try {
        const data = await this.subscriptionService.getSubscriptionDetails();
        this.details.set(data);
        return data;
      } catch {
        this.error.set(true);
        return null;
      } finally {
        this.loading.set(false);
      }
    },
  });

  private readonly invoicesResource = resource({
    loader: async (): Promise<SubscriptionInvoice[]> => {
      try {
        return await this.subscriptionService.getInvoices();
      } catch {
        return EMPTY_INVOICES;
      }
    },
    defaultValue: EMPTY_INVOICES,
  });
  protected readonly invoices = computed(() => this.invoicesResource.value() ?? EMPTY_INVOICES);

  private readonly plansResource = resource({
    loader: async (): Promise<SubscriptionPlan[]> => {
      try {
        return await this.plansService.getAllPlans();
      } catch {
        return EMPTY_PLANS;
      }
    },
    defaultValue: EMPTY_PLANS,
  });
  protected readonly plans = computed(() => this.plansResource.value() ?? EMPTY_PLANS);

  protected readonly currentPlanId = computed(() => {
    const tier = this.details()?.vipTier;
    if (!tier) return null;
    const matched = this.plans().find((p) => p.name.toLowerCase() === tier.toLowerCase());
    return matched ? matched.id : null;
  });

  protected readonly renewalLabel = computed(() => {
    const billing = this.details()?.billing;
    if (!billing) return null;
    const key = billing.cancelAtPeriodEnd ? 'subscription.endsOn' : 'subscription.renewsOn';
    return this.i18n.translate(key, { date: this.formatDate(billing.currentPeriodEnd) });
  });

  protected readonly cancelBannerMessage = computed(() => {
    const billing = this.details()?.billing;
    if (!billing?.cancelAtPeriodEnd) return null;
    return this.i18n.translate('subscription.cancelScheduledBanner', {
      date: this.formatDate(billing.currentPeriodEnd),
    });
  });

  protected readonly nextPaymentLabel = computed(() => {
    const billing = this.details()?.billing;
    if (!billing || billing.nextBillingAmount == null || !billing.currency) return null;
    return `${billing.nextBillingAmount.toFixed(2)} ${billing.currency.toUpperCase()}`;
  });

  protected formatDate(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.currentLang(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso));
  }

  protected reload(): void {
    this.detailsResource.reload();
    this.invoicesResource.reload();
  }

  protected async changePlan(planId: string, interval: 'month' | 'year'): Promise<void> {
    if (this.changingPlanId() === planId) return;
    this.changingPlanId.set(planId);
    this.actionError.set(null);
    try {
      const resp = await this.monetisationService.createCheckoutSession(planId, interval);
      if (resp.sessionUrl) {
        window.location.href = resp.sessionUrl;
      } else {
        this.changingPlanId.set(null);
      }
    } catch {
      this.changingPlanId.set(null);
      this.actionError.set(this.i18n.translate('subscription.actionError'));
    }
  }

  protected async onCancel(): Promise<void> {
    this.cancelling.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    try {
      await this.subscriptionService.cancelSubscription();
      this.actionSuccess.set(this.i18n.translate('subscription.cancelSuccess'));
      this.reload();
    } catch {
      this.actionError.set(this.i18n.translate('subscription.actionError'));
    } finally {
      this.cancelling.set(false);
    }
  }

  protected async onResume(): Promise<void> {
    this.resuming.set(true);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    try {
      await this.subscriptionService.resumeSubscription();
      this.actionSuccess.set(this.i18n.translate('subscription.resumeSuccess'));
      this.reload();
    } catch {
      this.actionError.set(this.i18n.translate('subscription.actionError'));
    } finally {
      this.resuming.set(false);
    }
  }

  protected async onManagePaymentMethod(): Promise<void> {
    this.openingPortal.set(true);
    this.actionError.set(null);
    try {
      const { url } = await this.subscriptionService.createBillingPortalSession();
      window.location.href = url;
    } catch {
      this.actionError.set(this.i18n.translate('subscription.portalError'));
      this.openingPortal.set(false);
    }
  }

  protected goBack(): void {
    this.location.back();
  }
}
