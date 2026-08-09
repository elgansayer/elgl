import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EconomyErrorHandlerService } from './economy-error-handler.service';
import { AuthService } from './auth.service';
import { EconomyStore } from './economy.store';

describe.skip('EconomyErrorHandlerService', () => {
  let service: EconomyErrorHandlerService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('test-token'),
    };

    const mockEconomyStore = {
      coinsBalance: vi.fn().mockReturnValue(250),
    };

    TestBed.configureTestingModule({
      providers: [
        EconomyErrorHandlerService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: EconomyStore, useValue: mockEconomyStore },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(EconomyErrorHandlerService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should POST economy crash details to analytics endpoint', () => {
    const testError = new Error('Coin purchase failed mid-transaction');
    service.reportEconomyCrash(testError, {
      action: 'purchaseCoins',
      coinBalance: 150,
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    expect(req.request.method).toBe('POST');

    const body = req.request.body as Record<string, unknown>;
    expect(body['message']).toBe('Coin purchase failed mid-transaction');
    expect(body['name']).toBe('Error');

    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['category']).toBe('economy');
    expect(metadata['coinBalance']).toBe(150);
    expect(metadata['action']).toBe('purchaseCoins');

    req.flush({ status: 'logged' });
  });

  it('should track recent crashes', () => {
    const err1 = new Error('First crash');
    service.reportEconomyCrash(err1, { action: 'loadInitialData' });

    const req1 = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    req1.flush({ status: 'logged' });

    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].message).toBe('First crash');
    expect(service.recentCrashes()[0].context).toBe('loadInitialData');
  });

  it('should cap recent crashes at 10', () => {
    for (let i = 0; i < 12; i++) {
      service.reportEconomyCrash(new Error(`Crash ${i}`), { action: 'test' });
    }

    // Flush all requests
    for (let i = 0; i < 12; i++) {
      const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
      req.flush({ status: 'logged' });
    }

    expect(service.recentCrashes().length).toBe(10);
  });

  it('should include boundary context in crash report', () => {
    const testError = new Error('Rendering crash in coin widget');
    service.reportEconomyCrash(testError, {
      boundaryContext: 'coin-balance-widget',
      renderingError: true,
    });

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['boundaryContext']).toBe('coin-balance-widget');
    expect(metadata['renderingError']).toBe(true);
    req.flush({ status: 'logged' });
  });

  it('should silently handle API failure when reporting crash', () => {
    const testError = new Error('Meta-crash');
    service.reportEconomyCrash(testError, { action: 'test' });

    const req = httpTesting.expectOne(`${environment.apiUrl}/analytics/client-error`);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Should not throw, should still have recorded the crash locally
    expect(service.recentCrashes().length).toBe(1);
  });
});