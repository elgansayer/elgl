import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SubscriptionService, SubscriptionDetails, SubscriptionInvoice } from './subscription.service';
import { environment } from '../../environments/environment';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/monetisation`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SubscriptionService],
    });
    service = TestBed.inject(SubscriptionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should fetch subscription details', async () => {
    const response: SubscriptionDetails = {
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
    };

    const resultPromise = service.getSubscriptionDetails();

    const req = httpMock.expectOne(`${baseUrl}/subscription`);
    expect(req.request.method).toBe('GET');
    req.flush(response);

    const result = await resultPromise;
    expect(result).toEqual(response);
  });

  it('should cancel the subscription', async () => {
    const response = { message: 'cancelled' };
    const resultPromise = service.cancelSubscription();

    const req = httpMock.expectOne(`${baseUrl}/subscription/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush(response);

    const result = await resultPromise;
    expect(result).toEqual(response);
  });

  it('should resume the subscription', async () => {
    const response = { message: 'resumed' };
    const resultPromise = service.resumeSubscription();

    const req = httpMock.expectOne(`${baseUrl}/subscription/resume`);
    expect(req.request.method).toBe('POST');
    req.flush(response);

    const result = await resultPromise;
    expect(result).toEqual(response);
  });

  it('should fetch billing history invoices', async () => {
    const response: SubscriptionInvoice[] = [
      {
        id: 'in_1',
        amountPaid: 8,
        currency: 'gbp',
        status: 'paid',
        created: '2026-08-01T00:00:00.000Z',
        invoicePdf: 'https://stripe.test/invoice.pdf',
        hostedInvoiceUrl: 'https://stripe.test/invoice',
      },
    ];

    const resultPromise = service.getInvoices();

    const req = httpMock.expectOne(`${baseUrl}/subscription/invoices`);
    expect(req.request.method).toBe('GET');
    req.flush(response);

    const result = await resultPromise;
    expect(result).toEqual(response);
  });

  it('should create a billing portal session', async () => {
    const response = { url: 'https://billing.stripe.com/session/test' };
    const resultPromise = service.createBillingPortalSession();

    const req = httpMock.expectOne(`${baseUrl}/subscription/billing-portal`);
    expect(req.request.method).toBe('POST');
    req.flush(response);

    const result = await resultPromise;
    expect(result).toEqual(response);
  });
});
