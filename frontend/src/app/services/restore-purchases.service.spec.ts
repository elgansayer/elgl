import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RestorePurchasesService } from './restore-purchases.service';
import { I18nService } from './i18n.service';
import { environment } from '../../environments/environment';

vi.mock('./toast.service', () => ({
  showToast: vi.fn(),
}));

describe('RestorePurchasesService', () => {
  let service: RestorePurchasesService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/monetisation/restore-purchases`;

  const translations: Record<string, string> = {
    'restorePurchases.success': 'Successfully restored your purchase(s).',
    'restorePurchases.noSubscriptionFound': 'No previous purchases found to restore.',
    'restorePurchases.failed': 'Failed to restore purchases. Please try again later.',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RestorePurchasesService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => translations[key] ?? key,
          },
        },
      ],
    });
    service = TestBed.inject(RestorePurchasesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('starts idle without a previous result', () => {
    expect(service.isRestoring()).toBe(false);
    expect(service.lastRestoreResult()).toBeNull();
  });

  it('restores Stripe purchases and preserves the returned tier', async () => {
    const promise = service.restorePurchases('stripe');

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ platform: 'stripe' });
    req.flush({ received: true, status: 'restored', tier: 'consumer' });

    await expect(promise).resolves.toEqual({
      success: true,
      restoredPlans: ['consumer'],
      message: 'Successfully restored your purchase(s).',
      status: 'restored',
      platform: 'stripe',
      tier: 'consumer',
    });
    expect(service.lastRestoreResult()?.status).toBe('restored');
    expect(service.isRestoring()).toBe(false);
  });

  it('trims receipt data before sending it', async () => {
    const promise = service.restorePurchases('ios', '  signed-receipt  ');

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.body).toEqual({ platform: 'ios', receipt_data: 'signed-receipt' });
    req.flush({ received: true, status: 'no_valid_subscription' });

    const result = await promise;
    expect(result.status).toBe('no_valid_subscription');
    expect(result.platform).toBe('ios');
    expect(result.message).toBe('No previous purchases found to restore.');
  });

  it('treats malformed or unknown backend outcomes as a retryable failure', async () => {
    const malformed = service.restorePurchases('stripe');
    httpMock.expectOne(baseUrl).flush({ received: false, status: 'restored' });
    expect((await malformed).status).toBe('failed');

    const unknown = service.restorePurchases('stripe');
    httpMock.expectOne(baseUrl).flush({ received: true, status: 'mystery' });
    expect((await unknown).status).toBe('failed');
  });

  it('handles network errors without leaving the restoring state stuck', async () => {
    const promise = service.restorePurchases('android', '{"purchaseToken":"x","productId":"y"}');

    expect(service.isRestoring()).toBe(true);
    httpMock.expectOne(baseUrl).error(new ProgressEvent('Network error'));

    const result = await promise;
    expect(result).toMatchObject({
      success: false,
      status: 'failed',
      platform: 'android',
      message: 'Failed to restore purchases. Please try again later.',
    });
    expect(service.isRestoring()).toBe(false);
  });

  it('deduplicates concurrent restore attempts so a double click cannot double-submit', async () => {
    const first = service.restorePurchases('stripe');
    const second = service.restorePurchases('stripe');

    const requests = httpMock.match(baseUrl);
    expect(requests).toHaveLength(1);
    requests[0].flush({ received: true, status: 'restored' });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.status).toBe('restored');
    expect(secondResult.status).toBe('restored');
    expect(service.isRestoring()).toBe(false);
  });
});
