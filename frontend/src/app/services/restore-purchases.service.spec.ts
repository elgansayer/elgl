import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RestorePurchasesService } from './restore-purchases.service';

describe('RestorePurchasesService', () => {
  let service: RestorePurchasesService;
  let httpMock: HttpTestingController;

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

  it('should have isRestoring starting as false', () => {
    expect(service.isRestoring()).toBe(false);
  });

  it('should have lastRestoreResult starting as null', () => {
    expect(service.lastRestoreResult()).toBeNull();
  });

  describe('restorePurchases', () => {
    it('should call backend API with platform and return restored on success', async () => {
      const promise = service.restorePurchases();
      expect(service.isRestoring()).toBe(true);

      const req = httpMock.expectOne('/api/monetisation/restore-purchases');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.platform).toBeDefined();
      req.flush({ received: true, status: 'restored' });

      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.message).toContain('restored successfully');
      expect(service.isRestoring()).toBe(false);
      expect(service.lastRestoreResult()?.success).toBe(true);
    });

    it('should return success=false when status is no_valid_subscription', async () => {
      const promise = service.restorePurchases();

      const req = httpMock.expectOne('/api/monetisation/restore-purchases');
      req.flush({ received: true, status: 'no_valid_subscription' });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.message).toContain('No previous purchases');
      expect(service.isRestoring()).toBe(false);
    });

    it('should handle unknown status gracefully', async () => {
      const promise = service.restorePurchases();

      const req = httpMock.expectOne('/api/monetisation/restore-purchases');
      req.flush({ received: true, status: 'processing' });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(service.isRestoring()).toBe(false);
    });

    it('should handle HTTP error', async () => {
      const promise = service.restorePurchases();

      const req = httpMock.expectOne('/api/monetisation/restore-purchases');
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to restore');
      expect(service.isRestoring()).toBe(false);
    });
  });
});