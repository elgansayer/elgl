import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { VipSubscriptionComponent } from './vip-subscription.component';
import {
  SubscriptionPlansService,
  SubscriptionPlan,
} from '../../services/subscription-plans.service';
import { I18nService } from '../../services/i18n.service';

describe('VipSubscriptionComponent', () => {
  let component: VipSubscriptionComponent;
  let fixture: ComponentFixture<VipSubscriptionComponent>;
  let subscriptionPlansService: {
    getAllPlans: ReturnType<typeof vi.fn>;
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
      highlighted_benefits: ['Start learning immediately'],
    },
    {
      id: 'consumer_8_ukp_10_usd',
      name: 'Consumer VIP',
      description: 'Unlock premium features for serious learners',
      price_ukp: 8,
      price_usd: 10,
      currency: 'USD',
      interval: 'month',
      is_popular: false,
      badge_text: 'Popular',
      features: [
        'Up to 3 target languages',
        'Unlimited AI translations & corrections',
        'Location spoofing (mock location)',
      ],
      highlighted_benefits: ['Unlimited AI translations & corrections'],
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
        'See who has bookmarked you',
        'Nearby members visibility boost',
        'Ad-free experience',
        'Up to 5 target languages',
      ],
      highlighted_benefits: [
        'Unlimited AI translations',
        'See who visited your profile',
        'Boosted visibility in Nearby',
        'Fully ad-free',
      ],
    },
    {
      id: 'developer_20_ukp_26_usd',
      name: 'Developer Tier',
      description: 'For power users who want programmatic access',
      price_ukp: 20,
      price_usd: 26,
      currency: 'USD',
      interval: 'month',
      badge_text: 'Power User',
      features: [
        'Everything in Consumer VIP',
        'Developer API key generation',
        '600 API calls per minute rate limit',
      ],
      highlighted_benefits: ['Full API access with 600 RPM rate limit'],
    },
  ];

  const mockI18nService = {
    translate: (key: string, params?: Record<string, unknown>) => {
      if (params && 'name' in params) return `Choose ${params['name']}`;
      return key;
    },
    currentLang: () => 'en',
  };

  beforeEach(async () => {
    subscriptionPlansService = {
      getAllPlans: vi.fn().mockResolvedValue(mockPlans),
    };

    await TestBed.configureTestingModule({
      imports: [VipSubscriptionComponent],
      providers: [
        provideRouter([]),
        { provide: SubscriptionPlansService, useValue: subscriptionPlansService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VipSubscriptionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('creates the component and loads subscription plans', () => {
    expect(component).toBeTruthy();
    expect(subscriptionPlansService.getAllPlans).toHaveBeenCalled();
    expect(component.plans().length).toBe(4);
  });

  it('identifies the popular Pro plan and computes paid plans', () => {
    const popular = component.popularPlan();
    expect(popular).toBeDefined();
    expect(popular?.id).toBe('pro_12_ukp_15_usd');
    expect(popular?.name).toBe('Pro');

    const paid = component.paidPlans();
    expect(paid.length).toBe(3);
    expect(paid.some((p) => p.id === 'pro_12_ukp_15_usd')).toBe(true);
  });

  it('exposes the four core Tandem Pro benefits on the Pro plan', () => {
    const proPlan = component.plans().find((p) => p.id === 'pro_12_ukp_15_usd');
    expect(proPlan).toBeDefined();
    expect(proPlan?.features).toEqual(
      expect.arrayContaining([
        'Unlimited AI translations',
        'Advanced visitor logs (who viewed your profile)',
        'Nearby members visibility boost',
        'Ad-free experience',
      ]),
    );
  });

  it('correctly maps feature categories for comparison', () => {
    const categories = component.getFeatureCategories();
    const visitorLogsCat = categories.find((c) => c.name === 'Advanced Visitor Logs');
    const nearbyBoostCat = categories.find((c) => c.name === 'Nearby Visibility Boost');

    const proPlan = mockPlans.find((p) => p.id === 'pro_12_ukp_15_usd')!;
    const freePlan = mockPlans.find((p) => p.id === 'free')!;

    expect(visitorLogsCat?.getValue(proPlan)).toBe(true);
    expect(visitorLogsCat?.getValue(freePlan)).toBe(false);
    expect(nearbyBoostCat?.getValue(proPlan)).toBe(true);
    expect(nearbyBoostCat?.getValue(freePlan)).toBe(false);
  });

  it('formats prices correctly for free and paid plans', () => {
    const freePlan = mockPlans.find((p) => p.id === 'free')!;
    const proPlan = mockPlans.find((p) => p.id === 'pro_12_ukp_15_usd')!;

    expect(component.getPriceDisplay(freePlan)).toBe('vip.freePrice');
    expect(component.getPriceDisplay(proPlan)).toBe('$15/mo');
  });

  it('returns distinctive icons for each plan tier', () => {
    expect(component.getPlanIcon('free')).toBe('🌟');
    expect(component.getPlanIcon('consumer_8_ukp_10_usd')).toBe('👑');
    expect(component.getPlanIcon('pro_12_ukp_15_usd')).toBe('💎');
    expect(component.getPlanIcon('developer_20_ukp_26_usd')).toBe('⚡');
  });
});
