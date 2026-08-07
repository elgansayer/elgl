import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EscrowService, EscrowPayment } from './escrow.service';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';
import { I18nService } from './i18n.service';
import { environment } from '../../environments/environment';

function createMockPayment(overrides: Partial<EscrowPayment> = {}): EscrowPayment {
  return {
    id: 'payment-1',
    payer_id: 'user-1',
    payee_id: 'user-2',
    amount_coins: 100,
    status: 'pending',
    description: 'Test payment',
    terms_locked: false,
    payer_approved: false,
    payee_approved: false,
    dispute_reason: null,
    dispute_resolved_by: null,
    refund_amount: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

describe('EscrowService', () => {
  let service: EscrowService;
  let httpMock: HttpTestingController;
  let authService: { getAccessToken: ReturnType<typeof vi.fn> };
  let networkStatus: { isOnline: ReturnType<typeof vi.fn> };
  let i18n: { translate: ReturnType<typeof vi.fn> };

  const baseUrl = `${environment.apiUrl}/escrow`;

  beforeEach(() => {
    authService = { getAccessToken: vi.fn().mockReturnValue('test-token') };
    networkStatus = { isOnline: vi.fn().mockReturnValue(true) };
    i18n = { translate: vi.fn().mockReturnValue('Test translation') };

    vi.stubGlobal('indexedDB', undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EscrowService,
        { provide: AuthService, useValue: authService },
        { provide: NetworkStatusService, useValue: networkStatus },
        { provide: I18nService, useValue: i18n },
      ],
    });

    service = TestBed.inject(EscrowService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.unstubAllGlobals();
  });

  describe('loadPayments', () => {
    it('should load payments when online', async () => {
      const mockPayments = [createMockPayment(), createMockPayment({ id: 'payment-2' })];

      const promise = service.loadPayments();
      const req = httpMock.expectOne(`${baseUrl}/payments`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPayments);

      await promise;
      expect(service.payments()).toEqual(mockPayments);
      expect(service.isLoading()).toBe(false);
    });

    it('should not make a network request when offline', async () => {
      networkStatus.isOnline.mockReturnValue(false);
      await service.loadPayments();
      httpMock.expectNone(`${baseUrl}/payments`);
    });
  });

  describe('createPayment', () => {
    it('should create a payment via API when online', async () => {
      const payload = { payee_id: 'user-2', amount_coins: 200, description: 'For services' };
      const mockResponse = createMockPayment({ amount_coins: 200, description: 'For services' });

      const promise = service.createPayment(payload);

      const req = httpMock.expectOne(`${baseUrl}/payments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(mockResponse);

      const result = await promise;
      expect(result?.id).toBe('payment-1');
    });

    it('should return null when offline (queue action)', async () => {
      networkStatus.isOnline.mockReturnValue(false);

      // Mock IndexedDB for offline queue
      const mockStore = new Map();
      vi.stubGlobal('indexedDB', {
        open: () => {
          const req = {
            result: {
              objectStoreNames: { contains: () => true },
              transaction: () => ({
                objectStore: () => ({
                  put: (action: unknown) => {
                    const a = action as { id: string };
                    mockStore.set(a.id, action);
                    const r = { result: null, error: null, _onsuccess: null as (() => void) | null };
                    Object.defineProperty(r, 'onsuccess', {
                      get() { return this._onsuccess; },
                      set(fn: () => void) { this._onsuccess = fn; fn(); },
                    });
                    return r;
                  },
                  getAll: () => {
                    const r = { result: [], error: null, _onsuccess: null as (() => void) | null };
                    Object.defineProperty(r, 'onsuccess', {
                      get() { return this._onsuccess; },
                      set(fn: () => void) { this._onsuccess = fn; fn(); },
                    });
                    return r;
                  },
                }),
              }),
            },
            error: null,
            _onsuccess: null as (() => void) | null,
            _onupgradeneeded: null as (() => void) | null,
          };
          Object.defineProperty(req, 'onsuccess', {
            get() { return this._onsuccess; },
            set(fn: () => void) { this._onsuccess = fn; setTimeout(fn, 0); },
          });
          Object.defineProperty(req, 'onupgradeneeded', {
            get() { return this._onupgradeneeded; },
            set(fn: () => void) { this._onupgradeneeded = fn; fn(); },
          });
          return req;
        },
      });

      // Re-create service with mocked IDB
      const svc = TestBed.inject(EscrowService);
      // Wait for DB init
      await new Promise((r) => setTimeout(r, 10));

      const payload = { payee_id: 'user-2', amount_coins: 500, description: 'Offline payment' };
      const result = await svc.createPayment(payload);

      expect(result).toBeNull();
      expect(svc.offlineQueueCount()).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPayment', () => {
    it('should fetch a single payment via API', async () => {
      const mockPayment = createMockPayment();

      const promise = service.getPayment('payment-1');
      const req = httpMock.expectOne(`${baseUrl}/payments/payment-1`);
      req.flush(mockPayment);

      const result = await promise;
      expect(result?.id).toBe('payment-1');
    });
  });

  describe('fundPayment', () => {
    it('should fund a payment via API', async () => {
      const mockPayment = createMockPayment({ status: 'funded' });

      const promise = service.fundPayment('payment-1');
      const fundReq = httpMock.expectOne(`${baseUrl}/payments/payment-1/fund`);
      fundReq.flush({});

      // The fundPayment also triggers loadPayments()
      const loadReq = httpMock.expectOne(`${baseUrl}/payments`);
      loadReq.flush([mockPayment]);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('completePayment', () => {
    it('should complete a payment via API', async () => {
      const mockPayment = createMockPayment({ status: 'completed', completed_at: new Date().toISOString() });

      const promise = service.completePayment('payment-1');
      const completeReq = httpMock.expectOne(`${baseUrl}/payments/payment-1/complete`);
      completeReq.flush({});

      const loadReq = httpMock.expectOne(`${baseUrl}/payments`);
      loadReq.flush([mockPayment]);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a payment via API', async () => {
      const mockPayment = createMockPayment({ status: 'cancelled' });

      const promise = service.cancelPayment('payment-1');
      const cancelReq = httpMock.expectOne(`${baseUrl}/payments/payment-1`);
      expect(cancelReq.request.method).toBe('PUT');
      expect(cancelReq.request.body).toEqual({ action: 'cancel' });
      cancelReq.flush({});

      const loadReq = httpMock.expectOne(`${baseUrl}/payments`);
      loadReq.flush([mockPayment]);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('raiseDispute', () => {
    it('should raise a dispute via API', async () => {
      const mockPayment = createMockPayment({ status: 'disputed', dispute_reason: 'Not as described' });

      const promise = service.raiseDispute('payment-1', 'Not as described');
      const disputeReq = httpMock.expectOne(`${baseUrl}/payments/payment-1`);
      expect(disputeReq.request.body).toEqual({ action: 'raise_dispute', reason: 'Not as described' });
      disputeReq.flush({});

      const loadReq = httpMock.expectOne(`${baseUrl}/payments`);
      loadReq.flush([mockPayment]);

      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('offline queue', () => {
    it('should enqueue fund action when offline', async () => {
      networkStatus.isOnline.mockReturnValue(false);

      const mockStore = new Map();
      vi.stubGlobal('indexedDB', {
        open: () => {
          const req = {
            result: {
              objectStoreNames: { contains: () => true },
              transaction: () => ({
                objectStore: () => ({
                  put: (action: unknown) => {
                    const a = action as { id: string };
                    mockStore.set(a.id, action);
                    const r = { result: null, error: null, _onsuccess: null as (() => void) | null };
                    Object.defineProperty(r, 'onsuccess', {
                      get() { return this._onsuccess; },
                      set(fn: () => void) { this._onsuccess = fn; fn(); },
                    });
                    return r;
                  },
                  getAll: () => {
                    const r = { result: Array.from(mockStore.values()), error: null, _onsuccess: null as (() => void) | null };
                    Object.defineProperty(r, 'onsuccess', {
                      get() { return this._onsuccess; },
                      set(fn: () => void) { this._onsuccess = fn; fn(); },
                    });
                    return r;
                  },
                }),
              }),
            },
            error: null,
            _onsuccess: null as (() => void) | null,
            _onupgradeneeded: null as (() => void) | null,
          };
          Object.defineProperty(req, 'onsuccess', {
            get() { return this._onsuccess; },
            set(fn: () => void) { this._onsuccess = fn; setTimeout(fn, 0); },
          });
          Object.defineProperty(req, 'onupgradeneeded', {
            get() { return this._onupgradeneeded; },
            set(fn: () => void) { this._onupgradeneeded = fn; fn(); },
          });
          return req;
        },
      });

      const svc = TestBed.inject(EscrowService);
      await new Promise((r) => setTimeout(r, 10));

      const result = await svc.fundPayment('payment-1');
      // Should queue and return true since it was accepted for offline processing
      expect(result).toBe(true);
    });
  });
});