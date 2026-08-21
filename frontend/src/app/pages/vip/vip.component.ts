import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../../components/primitives/button-primary/button-primary.component';
import { AppButtonSecondaryComponent } from '../../components/primitives/button-secondary/button-secondary.component';
import { AppCardComponent } from '../../components/primitives/card/card.component';
import { AppPillComponent } from '../../components/primitives/pill/pill.component';

interface VipPlan {
  id: string;
  nameKey: string;
  priceKey: string;
  isPopular: boolean;
  features: string[];
  ctaKey: string;
}

interface BenefitRow {
  labelKey: string;
  free: boolean;
  consumer: boolean;
  pro: boolean;
  developer: boolean;
}

interface FaqItem {
  questionKey: string;
  answerKey: string;
}

@Component({
  selector: 'app-vip',
  imports: [
    HlmButton,
    JoyrideModule,
    TranslatePipe,
    AppButtonPrimaryComponent,
    AppButtonSecondaryComponent,
    AppCardComponent,
    AppPillComponent,
  ],
  templateUrl: './vip.component.html',
  styleUrl: './vip.component.scss',
})
export class VipComponent {
  private readonly router = inject(Router);

  readonly plans = signal<VipPlan[]>([
    {
      id: 'free',
      nameKey: 'vip.freePlan',
      priceKey: 'vip.freePrice',
      isPopular: false,
      features: ['vip.freeFeature1', 'vip.freeFeature2', 'vip.freeFeature3'],
      ctaKey: 'vip.startFree',
    },
    {
      id: 'consumer',
      nameKey: 'vip.consumerPlan',
      priceKey: 'vip.consumerPrice',
      isPopular: false,
      features: [
        'vip.consumerFeature1',
        'vip.consumerFeature2',
        'vip.consumerFeature3',
        'vip.consumerFeature4',
      ],
      ctaKey: 'vip.subscribeNow',
    },
    {
      id: 'pro',
      nameKey: 'vip.proPlan',
      priceKey: 'vip.proPrice',
      isPopular: true,
      features: [
        'vip.proFeature1',
        'vip.proFeature2',
        'vip.proFeature3',
        'vip.proFeature4',
        'vip.proFeature5',
      ],
      ctaKey: 'vip.subscribeNow',
    },
    {
      id: 'developer',
      nameKey: 'vip.developerPlan',
      priceKey: 'vip.developerPrice',
      isPopular: false,
      features: [
        'vip.developerFeature1',
        'vip.developerFeature2',
        'vip.developerFeature3',
        'vip.developerFeature4',
        'vip.developerFeature5',
      ],
      ctaKey: 'vip.subscribeNow',
    },
  ]);

  readonly faqItems = signal<FaqItem[]>([
    { questionKey: 'vip.faqSwitchQ', answerKey: 'vip.faqSwitchA' },
    { questionKey: 'vip.faqTrialQ', answerKey: 'vip.faqTrialA' },
    { questionKey: 'vip.faqPaymentQ', answerKey: 'vip.faqPaymentA' },
    { questionKey: 'vip.faqCancelQ', answerKey: 'vip.faqCancelA' },
  ]);

  readonly openFaqIndex = signal<number | null>(null);

  readonly benefitRows = signal<BenefitRow[]>([
    { labelKey: 'vip.freeFeature1', free: true, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.freeFeature2', free: true, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.freeFeature3', free: true, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.consumerFeature1', free: false, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.consumerFeature2', free: false, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.consumerFeature3', free: false, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.consumerFeature4', free: false, consumer: true, pro: true, developer: true },
    { labelKey: 'vip.proFeature1', free: false, consumer: false, pro: true, developer: false },
    { labelKey: 'vip.proFeature2', free: false, consumer: false, pro: true, developer: false },
    { labelKey: 'vip.proFeature3', free: false, consumer: false, pro: true, developer: false },
    { labelKey: 'vip.proFeature4', free: false, consumer: false, pro: true, developer: false },
    { labelKey: 'vip.proFeature5', free: false, consumer: false, pro: true, developer: false },
    {
      labelKey: 'vip.developerFeature2',
      free: false,
      consumer: false,
      pro: false,
      developer: true,
    },
    {
      labelKey: 'vip.developerFeature3',
      free: false,
      consumer: false,
      pro: false,
      developer: true,
    },
    {
      labelKey: 'vip.developerFeature4',
      free: false,
      consumer: false,
      pro: false,
      developer: true,
    },
    {
      labelKey: 'vip.developerFeature5',
      free: false,
      consumer: false,
      pro: false,
      developer: true,
    },
  ]);

  scrollToPlans(): void {
    document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' });
  }

  onStartFree(): void {
    this.router.navigate(['/']);
  }

  onContinueFree(): void {
    this.router.navigate(['/']);
  }

  onSubscribe(planId: string): void {
    if (planId === 'free') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/subscription']);
    }
  }

  toggleFaq(idx: number): void {
    this.openFaqIndex.update((prev) => (prev === idx ? null : idx));
  }
}
