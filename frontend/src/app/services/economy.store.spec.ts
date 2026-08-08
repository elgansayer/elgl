import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EconomyStore } from './economy.store';
import { AuthService } from './auth.service';
import { CentrifugeService } from './centrifuge.service';
import { I18nService } from './i18n.service';
import { GiftAnimationService } from './gift-animation.service';
import { OfflineEconomyService } from './offline-economy.service';
import { NetworkStatusService } from './network-status.service';
import { environment } from '../../environments/environment';

function setup() {
  const mockAuthService = {
    getAccessToken: () => 'test-token',
    currentUser: () => ({ id: 'user-1', is_vip: false, vip_tier: 'free' }),
  };

  const mockCentrifugeService = { isConnected: () => false };
  const mockI18nService = { translate: (key: string, _params?: Record<string, unknown>) => key };
  const mockGiftAnimationService = { triggerAnimation: vi.fn() };
  const mockOfflineEconomyService = {};
  const mockNetworkStatusService = { isOnline: { asReadonly: () => true } };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      EconomyStore,
      { provide: AuthService, useValue: mockAuthService },
      { provide: CentrifugeService, useValue: mockCentrifugeService },
      { provide: I18nService, useValue: mockI18nService },
      { provide: GiftAnimationService, useValue: mockGiftAnimationService },
      { provide: OfflineEconomyService, useValue: mockOfflineEconomyService },
      { provide: NetworkStatusService, useValue: mockNetworkStatusService },
    ],
  });

  return {
    store: TestBed.inject(EconomyStore),
    httpCtrl: TestBed.inject(HttpTestingController),
  };
}

describe('EconomyStore developer features', () => {
  it('should be created', () => {
    const { store } = setup();
    expect(store).toBeTruthy();
  });

  it('should have initial null developerStats', () => {
    const { store } = setup();
    expect(store.developerStats()).toBeNull();
  });

  it('should have initial empty diagnosticLogs', () => {
    const { store } = setup();
    expect(store.diagnosticLogs()).toEqual([]);
  });

  it('should call POST generate-api-key with correct headers', async () => {
    const { store, httpCtrl } = setup();

    // generateApiKey() chains loadDeveloperAnalytics() + showToast() internally.
    // Just verify the POST request is made correctly.
    const promise = store.generateApiKey();

    const postReq = httpCtrl.expectOne(`${environment.apiUrl}/monetisation/generate-api-key`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.headers.get('Authorization')).toBe('Bearer test-token');

    // Reject to avoid the chained analytics call timing out
    postReq.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    const result = await promise;
    expect(result).toBeNull();

    httpCtrl.verify();
  });

  it('should fetch and update developerStats on loadDeveloperAnalytics', async () => {
    const { store, httpCtrl } = setup();
    const mockAnalytics = {
      api_key: 'ht_dev_existing',
      tier: 'developer',
      total_api_calls_today: 42,
      avg_latency_ms: 28,
      pricing_info: 'Developer Tier: 20 UKP / $26 USD per month',
    };

    const promise = store.loadDeveloperAnalytics();
    const req = httpCtrl.expectOne(`${environment.apiUrl}/monetisation/analytics`);
    expect(req.request.method).toBe('GET');
    req.flush(mockAnalytics);

    await promise;
    expect(store.developerStats()).toEqual(mockAnalytics);

    httpCtrl.verify();
  });

  it('should fetch and map diagnostic logs', async () => {
    const { store, httpCtrl } = setup();
    const mockLogs = [
      { id: '1', category: 'REDIS', status: 'success', message: 'Test', created_at: '2026-08-08T00:00:00Z' },
    ];

    const promise = store.loadDiagnosticLogs();
    const req = httpCtrl.expectOne(`${environment.apiUrl}/monetisation/diagnostics/logs`);
    expect(req.request.method).toBe('GET');
    req.flush(mockLogs);

    await promise;
    expect(store.diagnosticLogs().length).toBe(1);
    expect(store.diagnosticLogs()[0].category).toBe('REDIS');

    httpCtrl.verify();
  });

  it('should post and prepend diagnostic log', async () => {
    const { store, httpCtrl } = setup();
    const mockLog = {
      id: 'log-1',
      category: 'POSTGIS',
      status: 'info',
      message: 'Test message',
      created_at: '2026-08-08T00:00:00Z',
    };

    const promise = store.createDiagnosticLog({
      category: 'POSTGIS',
      status: 'info',
      message: 'Test message',
    });

    const req = httpCtrl.expectOne(`${environment.apiUrl}/monetisation/diagnostics/logs`);
    expect(req.request.method).toBe('POST');
    req.flush(mockLog);

    await promise;
    expect(store.diagnosticLogs().length).toBe(1);
    expect(store.diagnosticLogs()[0].message).toBe('Test message');

    httpCtrl.verify();
  });

  it('should cap diagnostic log message at 500 characters', async () => {
    const { store, httpCtrl } = setup();
    const longMessage = 'x'.repeat(600);
    const mockLog = {
      id: 'log-1',
      category: 'POSTGIS',
      status: 'info',
      message: longMessage.slice(0, 500),
      created_at: '2026-08-08T00:00:00Z',
    };

    const promise = store.createDiagnosticLog({
      category: 'POSTGIS',
      status: 'info',
      message: longMessage,
    });

    const req = httpCtrl.expectOne(`${environment.apiUrl}/monetisation/diagnostics/logs`);
    const sentPayload = req.request.body as Record<string, unknown>;
    expect((sentPayload['message'] as string).length).toBe(500);
    req.flush(mockLog);

    await promise;

    httpCtrl.verify();
  });
});