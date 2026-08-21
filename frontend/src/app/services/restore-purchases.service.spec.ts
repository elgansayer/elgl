import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RestorePurchasesService } from './restore-purchases.service';
import { environment } from '../../environments/environment';

describe.skip('RestorePurchasesService', () => {
  let service: RestorePurchasesService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiUrl}/monetisation/restore-purchases`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RestorePurchasesService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(RestorePurchasesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial state with isRestoring as false', () => {
    expect(service.isRestoring()).toBe(false);
    expect(service.lastRestoreResult()).toBeNull();
  });

  it('should call backend API and return success when status is restored', async () => {
    const promise = service.restorePurchases('stripe');

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ platform: 'stripe', receipt_data: undefined });
    req.flush({ received: true, status: 'restored' });

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.message).toBe('Successfully restored your purchase(s).');
    expect(service.isRestoring()).toBe(false);
  });

  it('should handle no_valid_subscription status', async () => {
    const promise = service.restorePurchases('ios', 'test-receipt');

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.body).toEqual({ platform: 'ios', receipt_data: 'test-receipt' });
    req.flush({ received: true, status: 'no_valid_subscription' });

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.message).toBe('No previous purchases found to restore.');
    expect(service.isRestoring()).toBe(false);
  });

  it('should handle API errors gracefully', async () => {
    const promise = service.restorePurchases();

    httpMock.expectOne(baseUrl).error(new ProgressEvent('Network error'));

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to restore purchases. Please try again later.');
    expect(service.isRestoring()).toBe(false);
  });

  it('should set isRestoring to true while request is pending', async () => {
    const promise = service.restorePurchases();

    expect(service.isRestoring()).toBe(true);

    httpMock.expectOne(baseUrl).flush({ received: true, status: 'restored' });

    await promise;
    expect(service.isRestoring()).toBe(false);
  });
});
