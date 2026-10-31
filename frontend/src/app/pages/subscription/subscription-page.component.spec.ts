import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionPageComponent } from './subscription-page.component';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { MonetisationService } from '../../services/monetisation.service';
import { I18nService } from '../../services/i18n.service';

describe('SubscriptionPageComponent', () => {
  let component: SubscriptionPageComponent;
  let fixture: ComponentFixture<SubscriptionPageComponent>;
  let subscriptionPlansService: {
    getAllPlans: ReturnType<typeof vi.fn>;
  };
  let monetisationService: {
    createCheckoutSession: ReturnType<typeof vi.fn>;
  };

  const mockPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Get started with basic language exchange features',
      price_ukp: 0,
      price_usd: 0,
      currency: 'USD',
      interval: 'month',
      features: ['1 target language', '10 AI translations per day'],
    },
    {
      id: 'consumer_8_ukp_10_usd',
      name: 'Consumer VIP',
      description: 'Unlock premium features for serious learners',
      price_ukp: 8,
      price_usd: 10,
      currency: 'USD',
      interval: 'month',
      features: ['Up to 3 target languages', 'Unlimited AI translations & corrections'],
    },
    {
      id: 'pro_12_ukp_15_usd',
      name: 'Pro',
      description:
        'Unlimited translations, advanced visitor insights, nearby visibility & ad-free',
      price_ukp: 12,
      price_usd: 15,
      currency: 'USD',
      interval: 'month',
      is_popular: true,
      badge_text: 'Best Value',
      features: [
        'Unlimited AI translations',
        'Advanced visitor logs (who viewed your profile)',
        'Nearby members visibility boost',
        'Ad-free experience',
        'Up to 5 target languages',
      ],
    },
  ];

  const mockI18nService = {
    translate: (key: string) => key,
    currentLang: () => 'en',
  };

  beforeEach(async () => {
    subscriptionPlansService = {
      getAllPlans: vi.fn().mockResolvedValue(mockPlans),
    };
    monetisationService = {
      createCheckoutSession: vi.fn().mockResolvedValue({
        sessionUrl: 'https://checkout.stripe.com/pay/cs_test_123',
        sessionId: 'cs_test_123',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SubscriptionPageComponent],
      providers: [
        { provide: SubscriptionPlansService, useValue: subscriptionPlansService },
        { provide: MonetisationService, useValue: monetisationService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubscriptionPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders all subscription plans including Pro', () => {
    expect(component).toBeTruthy();
    expect(component.plans().length).toBe(3);
    const pro = component.plans().find((p) => p.id === 'pro_12_ukp_15_usd');
    expect(pro).toBeDefined();
    expect(pro?.name).toBe('Pro');
    expect(pro?.features).toContain('Unlimited AI translations');
    expect(pro?.features).toContain('Advanced visitor logs (who viewed your profile)');
    expect(pro?.features).toContain('Nearby members visibility boost');
    expect(pro?.features).toContain('Ad-free experience');
  });

  it('calls createCheckoutSession when subscribing to Pro', async () => {
    await component.subscribe('pro_12_ukp_15_usd');
    expect(monetisationService.createCheckoutSession).toHaveBeenCalledWith(
      'pro_12_ukp_15_usd',
      'month',
    );
  });

  it('does not create a checkout session for the Free plan', async () => {
    await component.subscribe('free');
    expect(monetisationService.createCheckoutSession).not.toHaveBeenCalled();
  });
});
