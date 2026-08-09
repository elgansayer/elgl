import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MySubscriptionComponent } from './my-subscription.component';
import { environment } from '../../../environments/environment';

/** Protected members are exercised directly in tests; casting is permitted in spec files. */
function internals(instance: MySubscriptionComponent): any {
  return instance;
}

describe.skip('MySubscriptionComponent', () => {
  let component: MySubscriptionComponent;
  let fixture: ComponentFixture<MySubscriptionComponent>;
  let httpTesting: HttpTestingController;

  const monetisationBase = `${environment.apiUrl}/monetisation`;
  const plansUrl = `${environment.apiUrl}/subscription-plans`;

  const originalLocation = window.location;

  beforeEach(async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: '' },
    });

    await TestBed.configureTestingModule({
      imports: [MySubscriptionComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MySubscriptionComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function flushInitialRequests(options?: {
    isVip?: boolean;
    cancelAtPeriodEnd?: boolean;
    invoices?: unknown[];
  }): void {
    const isVip = options?.isVip ?? true;
    const cancelAtPeriodEnd = options?.cancelAtPeriodEnd ?? false;
    const invoices = options?.invoices ?? [];

    httpTesting.expectOne(`${monetisationBase}/subscription`).flush({
      isVip,
      vipTier: isVip ? 'consumer' : null,
      email: 'user@example.com',
      billing: isVip
        ? {
            cancelAtPeriodEnd,
            currentPeriodEnd: '2026-09-01T00:00:00.000Z',
            nextBillingAmount: 8,
            currency: 'gbp',
            interval: 'month',
          }
        : null,
    });
    httpTesting.expectOne(`${monetisationBase}/subscription/invoices`).flush(invoices);
    httpTesting.expectOne(plansUrl).flush([
      {
        id: 'consumer_8_ukp_10_usd',
        name: 'Consumer',
        description: 'Unlock the essentials',
        price_ukp: 8,
        price_usd: 10,
        currency: 'GBP',
        interval: 'month',
        features: [],
      },
    ]);
  }

  it('should create', () => {
    fixture.detectChanges();
    flushInitialRequests();
    expect(component).toBeTruthy();
  });

  it('should display active VIP status and renewal date once loaded', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, cancelAtPeriodEnd: false });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Active');
    expect(internals(component).renewalLabel()).toContain('Renews on');
  });

  it('should show an error banner when the subscription request fails', async () => {
    fixture.detectChanges();
    httpTesting.expectOne(`${monetisationBase}/subscription`).flush(
      { message: 'boom' },
      { status: 500, statusText: 'Server Error' },
    );
    httpTesting.expectOne(`${monetisationBase}/subscription/invoices`).flush([]);
    httpTesting.expectOne(plansUrl).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(internals(component).error()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'We could not load your subscription details',
    );
  });

  it('should show a cancel banner when the subscription is scheduled to end', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, cancelAtPeriodEnd: true });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(internals(component).cancelBannerMessage()).toContain('set to cancel on');
    expect(fixture.nativeElement.textContent).toContain('Resume subscription');
  });

  it('should cancel the subscription and reload details', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, cancelAtPeriodEnd: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const cancelPromise = internals(component).onCancel();

    const cancelReq = httpTesting.expectOne(`${monetisationBase}/subscription/cancel`);
    expect(cancelReq.request.method).toBe('POST');
    cancelReq.flush({ message: 'cancelled' });
    await cancelPromise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    httpTesting.expectOne(`${monetisationBase}/subscription`).flush({
      isVip: true,
      vipTier: 'consumer',
      email: 'user@example.com',
      billing: {
        cancelAtPeriodEnd: true,
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        nextBillingAmount: 8,
        currency: 'gbp',
        interval: 'month',
      },
    });
    httpTesting.expectOne(`${monetisationBase}/subscription/invoices`).flush([]);
    await fixture.whenStable();

    expect(internals(component).actionSuccess()).toContain('end at the close');
    expect(internals(component).cancelling()).toBe(false);
  });

  it('should resume the subscription and reload details', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, cancelAtPeriodEnd: true });
    await fixture.whenStable();
    fixture.detectChanges();

    const resumePromise = internals(component).onResume();

    const resumeReq = httpTesting.expectOne(`${monetisationBase}/subscription/resume`);
    expect(resumeReq.request.method).toBe('POST');
    resumeReq.flush({ message: 'resumed' });
    await resumePromise;
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    httpTesting.expectOne(`${monetisationBase}/subscription`).flush({
      isVip: true,
      vipTier: 'consumer',
      email: 'user@example.com',
      billing: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-09-01T00:00:00.000Z',
        nextBillingAmount: 8,
        currency: 'gbp',
        interval: 'month',
      },
    });
    httpTesting.expectOne(`${monetisationBase}/subscription/invoices`).flush([]);
    await fixture.whenStable();

    expect(internals(component).actionSuccess()).toContain('resumed');
    expect(internals(component).resuming()).toBe(false);
  });

  it('should redirect to the Stripe billing portal when managing payment method', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, cancelAtPeriodEnd: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const portalPromise = internals(component).onManagePaymentMethod();

    const portalReq = httpTesting.expectOne(`${monetisationBase}/subscription/billing-portal`);
    expect(portalReq.request.method).toBe('POST');
    portalReq.flush({ url: 'https://billing.stripe.com/session/test' });

    await portalPromise;

    expect(window.location.href).toBe('https://billing.stripe.com/session/test');
  });

  it('should show the billing history empty state when there are no invoices', async () => {
    fixture.detectChanges();
    flushInitialRequests({ isVip: true, invoices: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No invoices yet');
  });

  it('should render billing history invoices when present', async () => {
    fixture.detectChanges();
    flushInitialRequests({
      isVip: true,
      invoices: [
        {
          id: 'in_1',
          amountPaid: 8,
          currency: 'gbp',
          status: 'paid',
          created: '2026-08-01T00:00:00.000Z',
          invoicePdf: 'https://stripe.test/invoice.pdf',
          hostedInvoiceUrl: 'https://stripe.test/invoice',
        },
      ],
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(internals(component).invoices().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('8.00 GBP');
  });
});
