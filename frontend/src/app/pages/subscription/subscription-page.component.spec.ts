import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService } from '../../services/i18n.service';
import { MonetisationService } from '../../services/monetisation.service';
import {
  SubscriptionPlan,
  SubscriptionPlansService,
} from '../../services/subscription-plans.service';
import { SubscriptionPageComponent } from './subscription-page.component';

describe('SubscriptionPageComponent', () => {
  let component: SubscriptionPageComponent;
  let fixture: ComponentFixture<SubscriptionPageComponent>;
  let createCheckoutSession: ReturnType<typeof vi.fn>;

  const plans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Free plan',
      price_ukp: 0,
      price_usd: 0,
      currency: 'USD',
      interval: 'month',
      features: ['10 AI translations per day'],
    },
    {
      id: 'pro_12_ukp_15_usd',
      name: 'Pro',
      description: 'Pro plan',
      price_ukp: 12,
      price_usd: 15,
      currency: 'USD',
      interval: 'month',
      is_popular: true,
      features: [
        'Unlimited AI translations',
        'Advanced visitor logs (who viewed your profile)',
        'Nearby members visibility boost',
        'Ad-free experience',
      ],
    },
  ];

  beforeEach(async () => {
    createCheckoutSession = vi.fn();

    await TestBed.configureTestingModule({
      imports: [SubscriptionPageComponent],
      providers: [
        {
          provide: SubscriptionPlansService,
          useValue: { getAllPlans: vi.fn().mockResolvedValue(plans) },
        },
        {
          provide: MonetisationService,
          useValue: { createCheckoutSession },
        },
        {
          provide: I18nService,
          useValue: {
            currentLang: () => 'en-GB',
            translate: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the server-provided Pro plan and its four core benefits', () => {
    const pageText = fixture.nativeElement.textContent as string;

    expect(component.plans()).toEqual(plans);
    expect(pageText).toContain('Pro');
    expect(pageText).toContain('Unlimited AI translations');
    expect(pageText).toContain('Advanced visitor logs');
    expect(pageText).toContain('Nearby members visibility boost');
    expect(pageText).toContain('Ad-free experience');
  });

  it('does not create a checkout session for the free plan', async () => {
    await component.subscribe('free');

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(component.subscribingPlanId()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('subscription.page.currentFreePlan');
  });

  it('starts a server-authoritative Pro checkout without granting entitlement locally', () => {
    createCheckoutSession.mockReturnValue(new Promise(() => undefined));

    void component.subscribe('pro_12_ukp_15_usd');

    expect(createCheckoutSession).toHaveBeenCalledWith('pro_12_ukp_15_usd', 'month');
    expect(component.subscribingPlanId()).toBe('pro_12_ukp_15_usd');
  });

  it('surfaces checkout failure and allows a retry', async () => {
    createCheckoutSession.mockRejectedValue(new Error('checkout unavailable'));

    await component.subscribe('pro_12_ukp_15_usd');

    expect(component.subscribingPlanId()).toBeNull();
    expect(component.errorMessage()).toBe('checkout unavailable');
  });
});
