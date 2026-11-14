import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  SubscriptionPlan,
  SubscriptionPlansService,
} from '../../services/subscription-plans.service';
import { I18nService } from '../../services/i18n.service';
import { SubscriptionPlansComponent } from './subscription-plans.component';

const monthlyPlan: SubscriptionPlan = {
  id: 'consumer',
  name: 'Consumer',
  description: 'Learn every day',
  price_ukp: 8,
  price_usd: 10,
  currency: 'GBP',
  interval: 'month',
  features: ['Unlimited translations'],
  is_popular: true,
  highlighted_benefits: ['AI corrections'],
};

const freePlan: SubscriptionPlan = {
  ...monthlyPlan,
  id: 'free',
  name: 'Free',
  price_ukp: 0,
  price_usd: 0,
  is_popular: false,
  highlighted_benefits: [],
};

describe('SubscriptionPlansComponent', () => {
  let http: HttpTestingController;
  let getAllPlans: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getAllPlans = vi.fn().mockResolvedValue([monthlyPlan, freePlan]);

    await TestBed.configureTestingModule({
      imports: [SubscriptionPlansComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SubscriptionPlansService,
          useValue: { getAllPlans },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the offered plans into the signal state', async () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAllPlans).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.plans()).toEqual([monthlyPlan, freePlan]);
    expect(fixture.componentInstance.billingInterval()).toBe('month');
  });

  it('formats monthly, yearly and free prices', () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    const component = fixture.componentInstance;

    expect(component.getDisplayPrice(monthlyPlan)).toBe('£8 / $10 USD');
    expect(component.getDisplayPrice(freePlan)).toBe('Free');

    component.billingInterval.set('year');
    expect(component.getDisplayPrice(monthlyPlan)).toBe('£50 / $63 USD');
  });

  it('highlights the popular plan and leaves others neutral', () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    const component = fixture.componentInstance;

    expect(component.getPlanCardClass(monthlyPlan)).toContain('border-vip');
    expect(component.getPlanCardClass(freePlan)).toContain(
      'border-surface-100',
    );
  });

  it('creates a Stripe checkout session for a paid plan', async () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    const component = fixture.componentInstance;
    component.billingInterval.set('year');

    void component.onSelectPlan(monthlyPlan);

    const request = http.expectOne(
      `${environment.apiUrl}/monetisation/create-checkout-session`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      planId: 'consumer',
      interval: 'year',
    });
    request.error(new ProgressEvent('error'));

    await fixture.whenStable();
    expect(component.loading()).toBe(false);
  });

  it('does not create a checkout session for the free plan', async () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    const component = fixture.componentInstance;

    await component.onSelectPlan(freePlan);

    http.expectNone(
      `${environment.apiUrl}/monetisation/create-checkout-session`,
    );
  });

  it('renders an accessible button for every plan', async () => {
    const fixture = TestBed.createComponent(SubscriptionPlansComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      expect(button.textContent?.trim()).not.toBe('');
    }
    const submitButtons = buttons.filter(
      (button) => button.getAttribute('type') === 'button',
    );
    expect(submitButtons.length).toBeGreaterThan(0);
  });
});
