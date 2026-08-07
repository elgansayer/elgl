import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EconomyErrorHandlerService } from './economy-error-handler.service';
import { AuthService } from './auth.service';
import { EconomyStore } from './economy.store';
import { environment } from '../../environments/environment';

const ANALYTICS_URL = `${environment.apiUrl}/analytics/client-error`;
const OFFLINE_CRASH_STORE_KEY = 'offline_crash_reports';

describe('EconomyErrorHandlerService', () => {
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
    service.clearCrashData();
    localStorage.removeItem(OFFLINE_CRASH_STORE_KEY);
  });

  afterEach(() => {
    httpTesting.verify();
    service.clearCrashData();
    localStorage.removeItem(OFFLINE_CRASH_STORE_KEY);
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

    const req = httpTesting.expectOne(ANALYTICS_URL);
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

    const req1 = httpTesting.expectOne(ANALYTICS_URL);
    req1.flush({ status: 'logged' });

    expect(service.recentCrashes().length).toBe(1);
    expect(service.recentCrashes()[0].message).toBe('First crash');
    expect(service.recentCrashes()[0].context).toBe('loadInitialData');
  });

  it('should cap recent crashes at 20', () => {
    for (let i = 0; i < 25; i++) {
      service.reportEconomyCrash(new Error(`Crash ${i}`), { action: 'test' });
    }

    // Flush all pending requests at once
    const requests = httpTesting.match(ANALYTICS_URL);
    expect(requests.length).toBe(25);
    for (const req of requests) {
      req.flush({ status: 'logged' });
    }

    expect(service.recentCrashes().length).toBe(20);
  });

  it('should include boundary context in crash report', () => {
    const testError = new Error('Rendering crash in coin widget');
    service.reportEconomyCrash(testError, {
      boundaryContext: 'coin-balance-widget',
      renderingError: true,
    });

    const req = httpTesting.expectOne(ANALYTICS_URL);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['boundaryContext']).toBe('coin-balance-widget');
    expect(metadata['renderingError']).toBe(true);
    req.flush({ status: 'logged' });
  });

  it('should silently handle API failure when reporting crash', async () => {
    const testError = new Error('Meta-crash');
    service.reportEconomyCrash(testError, { action: 'test' });

    const req = httpTesting.expectOne(ANALYTICS_URL);
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Wait for the async catch handler to process
    await Promise.resolve();

    // Should not throw, should still have recorded the crash locally
    expect(service.recentCrashes().length).toBe(1);
  });

  it('should expose crash statistics via computed signal', () => {
    service.reportEconomyCrash(new Error('Crash A'), { action: 'buyCoins' });
    const req1 = httpTesting.expectOne(ANALYTICS_URL);
    req1.flush({ status: 'logged' });

    service.reportEconomyCrash(new Error('Crash B'), { action: 'sendGift' });
    const req2 = httpTesting.expectOne(ANALYTICS_URL);
    req2.flush({ status: 'logged' });

    service.reportEconomyCrash(new Error('Crash C'), { action: 'buyCoins' });
    const req3 = httpTesting.expectOne(ANALYTICS_URL);
    req3.flush({ status: 'logged' });

    const stats = service.crashStats();
    expect(stats.totalCrashes).toBe(3);
    expect(stats.crashesLast24h).toBe(3);
    const buyCoinsEntry = stats.topCrashActions.find((a) => a.action === 'buyCoins');
    expect(buyCoinsEntry?.count).toBe(2);
  });

  it('should clear all crash data', () => {
    service.reportEconomyCrash(new Error('Crash to clear'), { action: 'test' });
    const req = httpTesting.expectOne(ANALYTICS_URL);
    req.flush({ status: 'logged' });

    expect(service.recentCrashes().length).toBe(1);
    service.clearCrashData();
    expect(service.recentCrashes().length).toBe(0);
    expect(service.offlineQueueSize()).toBe(0);
  });

  it('should add componentName to metadata when provided', () => {
    const testError = new Error('Component rendering failure');
    service.reportEconomyCrash(testError, {
      action: 'renderCoins',
      componentName: 'CoinBalanceWidget',
    });

    const req = httpTesting.expectOne(ANALYTICS_URL);
    const body = req.request.body as Record<string, unknown>;
    const metadata = body['metadata'] as Record<string, unknown>;
    expect(metadata['componentName']).toBe('CoinBalanceWidget');
    req.flush({ status: 'logged' });
  });

  it('should queue crash for offline sync when API POST fails', async () => {
    service.reportEconomyCrash(new Error('Delayed crash'), { action: 'sendGift' });
    const req1 = httpTesting.expectOne(ANALYTICS_URL);
    req1.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    // Wait for the async catch handler to queue the crash into localStorage
    await vi.waitFor(
      () => {
        expect(service.offlineQueueSize()).toBe(1);
      },
      { timeout: 2000, interval: 10 },
    );
  });

  it('should successfully sync queued offline crash reports', async () => {
    // Queue a crash by failing the POST
    service.reportEconomyCrash(new Error('Offline crash sync'), { action: 'test' });
    const req1 = httpTesting.expectOne(ANALYTICS_URL);
    req1.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    await vi.waitFor(
      () => {
        expect(service.offlineQueueSize()).toBe(1);
      },
      { timeout: 2000, interval: 10 },
    );

    // Sync should now send the retry request
    const syncPromise = service.syncOfflineCrashes();

    const retryReq = httpTesting.expectOne(ANALYTICS_URL);
    expect(retryReq.request.body['message']).toBe('Offline crash sync');
    retryReq.flush({ status: 'logged' });

    const result = await syncPromise;
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(service.offlineQueueSize()).toBe(0);
  });
});
